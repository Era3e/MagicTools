# 深度补充 · AI 回复失败气泡重试功能

> 适用页面：`pages/assistant-front.html`（智能助手前台 · 对话区）
> 母文档：《前台交互说明 · 前台分册》§4.9 错误态 —— 本文档为其 §4 对话气泡错误态的深度展开
> 令牌体系：墨蓝石墨·工房感 v2.2 · assistant accent（--app-assistant 瓷青）
> 事实来源：所有类名与基线规格均取自 `assistant-front.html` 实际实现（pg-bubble / pg-bubble-bot / pg-bubble-typing / pg-typing-dot / pg-cite / pg-send），扩展类以此为基础派生

---

## 目录

1. [设计原则](#1-设计原则)
2. [真实 DOM 基线](#2-真实-dom-基线)
3. [消息状态机](#3-消息状态机)
4. [失败气泡视觉规格](#4-失败气泡视觉规格)
5. [错误分类与文案矩阵](#5-错误分类与文案矩阵)
6. [重试交互时序](#6-重试交互时序)
7. [动效规格](#7-动效规格)
8. [可访问性](#8-可访问性)
9. [边界场景](#9-边界场景)
10. [开发对接要点](#10-开发对接要点)

---

## 1. 设计原则

1. **对话连续性优先**：错误不打断会话流。失败气泡占据消息流中的正常位置（不弹窗、不 toast 遮挡），用户视线不需要离开上下文。
2. **错误即消息**：失败回复本身是消息流的一等公民，与用户消息、AI 消息同构渲染，可随会话滚动回看。
3. **重试幂等**：重试始终从「用户那一条消息」重新发起，不续写半截内容；已生成的半截输出折叠保留供参考（见 §9.3）。
4. **克制工房感**：错误呈现用色块 + 发丝线 + 文案，不用旋转 spinner、不用大幅抖动；重试动效复用现有 typing 三点。
5. **静默优先恢复**：先自动重试 1 次（用户无感），仍失败才升级为可见错误态，避免网络抖动污染对话界面。

---

## 2. 真实 DOM 基线

重试功能建立在以下已实现的类名契约之上（均存在于 `assistant-front.html`）：

| 类名 | 现有职责 | 基线规格（实测） |
| --- | --- | --- |
| `.pg-row` / `.pg-row-bot` | 消息行容器 | `display:flex`，bot 行 `justify-content:flex-start` |
| `.pg-bubble` | 气泡基类 | `max-width:min(600px,100%)`，`padding:12px 16px`，`border-radius:var(--radius-lg)`，`font-size:14px`，`line-height:1.65` |
| `.pg-bubble-bot` | 助手气泡 | `background:var(--surface-2)`，`color:var(--text-body)`，`border-top-left-radius:0`（左上无圆角，指向头像侧） |
| `.pg-bubble-typing` | 生成中气泡 | `display:inline-flex`，`gap:5px`，`padding:14px 18px`，`aria-label="助手正在输入"` |
| `.pg-typing-dot` | 打字点 | `6px` 圆点，`background:var(--app-assistant)`，`opacity:.5`，`animation:pg-typing-bounce 1.2s var(--ease-standard) infinite` |
| `.pg-cite` | 引用来源行 | `margin-top:10px`，`--font-mono`，`11px`，气泡内底部 |
| `.pg-composer` / `.pg-send` | 输入区与发送钮 | 发送钮 36px 高，`background:var(--app-assistant)`，hover 变 `--app-assistant-ink` |
| `.pg-session-item` | 会话侧栏项 | `data-active` 驱动激活 |

**扩展原则**：错误态一律通过在 `.pg-bubble-bot` 上追加 `pg-bubble-error` 修饰类实现，不新建平行结构；重试按钮挂载在气泡内部底部，与 `.pg-cite` 同一视觉层级。

---

## 3. 消息状态机

一条「AI 回复」消息的完整生命周期：

```
用户发送
   │
   ▼
┌─────────┐  流式首字节   ┌───────────┐  流式完成   ┌──────┐
│ pending │ ───────────▶ │ streaming │ ──────────▶ │ done │
│ (typing)│              │ (增量渲染) │             │ 正常 │
└─────────┘              └─────┬─────┘             └──────┘
   │ 失败(首次)                 │ 流式中断
   │ 自动重试1次(静默)           │ 自动重试1次(静默)
   │ 仍失败                     │ 仍失败
   ▼                           ▼
┌──────────────┐  点击重试    ┌─────────┐
│ failed-idle  │ ──────────▶ │ retrying│──▶ 回到 streaming / done
│ (可见错误态)  │  (手动,最多3)│ (typing)│
└──────────────┘             └─────────┘
```

### 状态定义表

| 状态 | 触发条件 | DOM 呈现 | 用户输入区 |
| --- | --- | --- | --- |
| `pending` | 用户点击发送 | `.pg-bubble-bot.pg-bubble-typing` 三点跳动 | 发送钮禁用（同会话单飞行） |
| `streaming` | 收到首个流式分片 | 正常气泡增量渲染 | 发送钮禁用 |
| `done` | 流式结束 | 正常气泡 +（可选）`.pg-cite` | 恢复可用 |
| `failed-auto` | 失败但仍在自动重试 | **保持 typing 态**（静默，用户无感） | 发送钮禁用 |
| `failed-idle` | 自动重试耗尽 | `.pg-bubble-bot.pg-bubble-error`（§4） | 恢复可用 |
| `retrying` | 用户点击重试 | 回到 typing 态，气泡顶部保留「第 N 次尝试」mono 微标 | 发送钮禁用 |

**关键规则**：`failed-idle` 常驻消息流，不自动消失、不自动折叠；重试入口永不失效（会话存活期间随时可点）。

---

## 4. 失败气泡视觉规格

### 4.1 气泡容器（`pg-bubble-error` 修饰类）

在 `.pg-bubble-bot` 基线上覆盖以下属性：

```css
.pg-bubble-error {
  background: var(--state-error-bg);        /* 亮色域 #faf1f0 */
  color: var(--state-error-text);           /* 亮色域 --mt-error-700 */
  border: 1px solid var(--state-error);     /* 亮色域 --mt-error-600 */
  border-top-left-radius: 0;                /* 继承 bot 气泡指向性 */
  padding: 12px 16px;                       /* 与基类一致 */
}
```

### 4.2 气泡内部构成（自上而下）

| # | 元素 | 规格 | 令牌 |
| --- | --- | --- | --- |
| 1 | 状态图标行 | `alert-triangle` 图标 14px + 状态词「回复生成失败」，`--font-body` 13px/600 | 图标与文字均 `--state-error-text`；行距 `margin-bottom:6px` |
| 2 | 失败描述 | 一句话原因 + 重试指引，`--font-body` 13px/1.6 | `--state-error-text`，`opacity:.85` |
| 3 | 错误码 + 时间戳 | `ERR-LLM-502 · 14:32:07`，`--font-mono` 11px | `--text-faint`；位于描述下 `margin-top:6px` |
| 4 | 重试动作行 | 重试按钮 + 尝试计数，`margin-top:10px` | 见 4.3 |

半截输出（流式中断场景）在第 1 行之前插入折叠区，见 §9.3。

### 4.3 重试按钮

```css
.pg-retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 14px;
  background: var(--surface-1);
  border: 1px solid var(--state-error);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--state-error-text);
  cursor: pointer;
}
.pg-retry-btn:hover  { background: var(--surface-0); border-color: var(--mt-error-700); }
.pg-retry-btn:active { background: var(--surface-2); }
.pg-retry-btn:focus-visible { outline: 2px solid var(--mt-error-600); outline-offset: 2px; }
.pg-retry-btn[disabled] { opacity: .45; cursor: not-allowed; }
```

- 按钮内图标：`refresh-cw` 13px。
- 计数徽标：第 2 次手动重试起，按钮文案显示 `重试（2/3）`，计数用 `--font-mono`。
- 3/3 耗尽后按钮变为「已重试 3 次」，`disabled`，旁边出现次级链接「换个问法」（见 §9.4）。

### 4.4 与正常气泡的视觉对比

| 维度 | 正常 bot 气泡 | 错误气泡 |
| --- | --- | --- |
| 底色 | `--surface-2` | `--state-error-bg` |
| 描边 | 无 | `1px --state-error` 发丝描边 |
| 圆角 | `--radius-lg`（左上 0） | 同左，不变 |
| 指向性 | 左上无圆角 | 左上无圆角（同一侧，保持流的可读性） |
| 尾部元素 | `.pg-cite` 引用 | 重试动作行 |

---

## 5. 错误分类与文案矩阵

| 错误码（mono） | 场景 | 可自动重试 | 可手动重试 | 描述文案 | 重试按钮文案 |
| --- | --- | --- | --- | --- | --- |
| `ERR-NET-001` | 网络中断 / 请求未达网关 | 是（1 次） | 是 | 网络连接中断，请检查网络后重试。 | 重试 |
| `ERR-GW-504` | 网关等待模型响应超时 | 是（1 次） | 是 | 服务响应超时，稍等片刻再试一次。 | 重试 |
| `ERR-LLM-502` | 模型路由失败 / 上游错误 | 是（1 次） | 是 | 模型服务暂时不可用，正在等待恢复。 | 重试 |
| `ERR-LLM-429` | 模型限流 | 否 | 是（倒计时解锁） | 当前提问人数较多，请稍候 15 秒再试。 | 重试（15s）→ 倒计时归零变「重试」 |
| `ERR-SAFE-451` | 内容安全拦截 | 否 | **否（不可重试）** | 该请求未通过内容安全检查，请调整表述后重新提问。 | 无重试钮，显示「换个问法」链接 |
| `ERR-CUT-STREAM` | 流式输出中断 | 是（1 次，静默续试） | 是 | 回复传输中断，已保留已生成部分。 | 重试 |

**文案规范**：描述一律中文、一句话、不超过 24 字；错误码与时间戳合并为 mono 行；禁止向用户暴露堆栈或英文报错。

---

## 6. 重试交互时序

### 6.1 自动重试（静默，第一道防线）

```
失败发生 ──▶ 保持 typing 态（用户无感）
         ──▶ 2s 后自动重发同一条用户消息
         ──▶ 成功：直接进入 streaming，仿佛无事发生
         ──▶ 失败：气泡切换为 failed-idle 错误态（§4）
```

自动重试仅 1 次，任何错误码相同处理（`ERR-SAFE-451` 直接跳到错误态不自动重试）。

### 6.2 手动重试（第二道防线）

| 步骤 | 系统行为 | 气泡呈现 | 输入区 |
| --- | --- | --- | --- |
| 1. 用户点击「重试」 | 冻结按钮 → 禁用，文案暂不变 | 错误态内容淡出（120ms），气泡回到 typing 三点 | 发送钮禁用 |
| 2. 请求重建 | 以原用户消息重新发起（幂等） | typing 态持续；若为第 ≥2 次尝试，气泡上方显示 mono 微标 `ATTEMPT 2/3`（11px，`--text-faint`） | 保持禁用 |
| 3a. 成功 | 流式渲染 | typing → 正常气泡；`ATTEMPT` 微标随成功消散 | 恢复 |
| 3b. 失败 | 计数 +1 | 回到错误态，按钮文案更新为 `重试（N/3）` | 恢复 |
| 4. 3 次耗尽 | 停止计数 | 错误态常驻，按钮变 disabled「已重试 3 次」+ 次级链接 | 恢复 |

### 6.3 重试期间的新消息

- 允许用户继续在输入框打字，但**发送按钮禁用**直至该消息离开 `pending/retrying` 态（同会话单飞行原则）。
- 错误态（`failed-idle`）不阻塞发送：用户可直接发新消息，旧错误气泡原样留在流中，随时可回看重试。

---

## 7. 动效规格

| 动效 | 触发 | 实现 | 降级 |
| --- | --- | --- | --- |
| 错误态入场 | `failed-auto → failed-idle` | 120ms `opacity 0→1` + `translateY(2px→0)`，`--ease-standard`；不使用 shake/抖动（工房感克制原则） | reduced-motion 下直接显示 |
| 重试切换 | 点击重试 → typing | 错误内容 120ms 淡出，typing 三点复用现有 `pg-typing-bounce`（1.2s 无限） | 三点静态、`opacity:.7`（现有降级） |
| 重试按钮 hover | 指针悬停 | `background` 过渡 120ms（`--duration-fast`） | 无需降级（纯色变） |
| 倒计时（429） | 限流锁定期 | 按钮文案每秒更新 `重试（Ns）`，无进度环 | 直接显示静态秒数 |
| 成功消散 | `retrying → done` | `ATTEMPT` 微标 120ms 淡出 | 直接移除 |

全局遵循现有 `@media (prefers-reduced-motion: reduce)` 块：所有过渡置 none。

---

## 8. 可访问性

1. **播报**：`failed-idle` 气泡容器设 `role="alert"`（首次进入错误态时读屏器立即播报状态词与描述）；`retrying` 回 typing 时恢复现有 `aria-label="助手正在输入"`。
2. **重试按钮语义**：`aria-label="重新生成回复，第 {N} 次，共 3 次"`；倒计时锁定时 `aria-disabled="true"`。
3. **焦点管理**：点击重试后焦点保留在重试按钮（此时禁用，焦点不丢失）；3 次耗尽按钮 disabled 时，焦点自动移至次级链接「换个问法」。
4. **键盘路径**：Tab 可达重试按钮；Enter/Space 触发（原生 button 行为）；错误气泡本身不进 Tab 序（非交互容器）。
5. **对比度**：`--state-error-text`（#76312b 系）在 `--state-error-bg`（#faf1f0）上的对比度 ≥ 4.5:1，满足正文级；错误码 mono 行用 `--text-faint` 仅作辅助信息（11px 非关键内容）。

---

## 9. 边界场景

### 9.1 会话切换与持久化

错误态随会话持久化：切到其它会话再切回，`failed-idle` 气泡与剩余重试次数原样恢复；重试计数按「单条消息」计，不随会话切换清零。

### 9.2 连续多条失败

同会话允许多条错误气泡并存（各自独立计数）。当**连续 3 条消息**均最终失败时，在对话流底部追加一条系统提示条（`--state-warning-bg` 底 + warning 描边，样式与错误气泡同构）：「助手服务可能不稳定，可查看服务状态」——链接至平台总览页（`index.html`）的服务状态区，形成前后台故障感知闭环。

### 9.3 流式中断的半截输出（`ERR-CUT-STREAM`）

已生成的部分不丢弃：在错误气泡顶部插入折叠区——

- 折叠头：`已生成部分（折叠）`，13px，`--font-body`，`--text-muted`，可点击展开；
- 展开后为正常文字排版（`--text-body`，与正常气泡一致）；
- 重试成功后折叠区自动移除，以完整回复替代（幂等原则：重试总是完整重生成，不做续写）。

### 9.4 三次耗尽的出路

- 次级链接「换个问法」：点击聚焦输入框并全选上一条用户消息，引导改写。
- 辅助链接「查看服务状态」：跳转 `index.html` 服务状态区（与 9.2 同目标）。

### 9.5 与后台意图日志的关联

每条错误在 `assistant-admin.html` 意图日志表格落一行：状态列徽标取 `error` tone（文案「拦截」或「失败」按错误码归类），会话 ID 与前台 `pg-stage-id`（如 `CHAT-2026-0908-A7F2`）一致，`ERR-*` 错误码进入日志明细——前台重试与后台排障使用同一套编码。

---

## 10. 开发对接要点

### 10.1 错误气泡 DOM 模板

```html
<div class="pg-row pg-row-bot">
  <div class="pg-bubble pg-bubble-bot pg-bubble-error" role="alert">
    <!-- 可选：流式中断折叠区（§9.3） -->
    <div class="pg-err-head">
      <i data-lucide="alert-triangle" aria-hidden="true"></i>
      <span>回复生成失败</span>
    </div>
    <p class="pg-err-desc">模型服务暂时不可用，正在等待恢复。</p>
    <div class="pg-err-meta">ERR-LLM-502 · 14:32:07</div>
    <div class="pg-err-actions">
      <button class="pg-retry-btn" type="button"
              aria-label="重新生成回复，第 1 次，共 3 次">
        <i data-lucide="refresh-cw" aria-hidden="true"></i>
        <span>重试</span>
      </button>
      <!-- 3 次耗尽后追加： -->
      <!-- <a class="pg-err-alt" href="#">换个问法</a> -->
    </div>
  </div>
</div>
```

### 10.2 类名与事件清单

| 项 | 值 |
| --- | --- |
| 新增类 | `pg-bubble-error` / `pg-err-head` / `pg-err-desc` / `pg-err-meta` / `pg-err-actions` / `pg-retry-btn` / `pg-err-alt` / `pg-attempt-tag` |
| 复用类 | `pg-bubble` / `pg-bubble-bot` / `pg-bubble-typing` / `pg-typing-dot` / `pg-row-bot` |
| 状态数据 | `message.status: pending \| streaming \| done \| failed-auto \| failed-idle \| retrying`、`retryCount: 0-3`、`errCode: ERR-*` |
| 组件事件 | `onRetry(messageId)`（按钮点击）、`onRetryExhausted(messageId)`（3 次耗尽）、`onAltPhrasing(messageId)`（换个问法） |
| 上游依赖 | 网关超时阈值（`ERR-GW-504` 判定）、限流头（429 → 倒计时秒数）、内容安全码（451 → 不可重试） |

### 10.3 验收清单

- [ ] 五类错误码分别呈现正确文案与按钮可用性（§5 矩阵逐行核对）
- [ ] 自动重试 1 次期间用户无感（typing 态不闪断）
- [ ] 手动重试 3 次计数与按钮文案正确递进
- [ ] `ERR-SAFE-451` 无重试按钮、不自动重试
- [ ] `ERR-LLM-429` 倒计时每秒递减，归零解锁
- [ ] 重试期间发送钮禁用、错误态（idle）不阻塞新消息
- [ ] 流式中断折叠区可展开，重试成功后移除
- [ ] 连续 3 条失败出现服务状态提示条并正确跳转
- [ ] `role="alert"` 播报一次且不重复；焦点链完整
- [ ] `prefers-reduced-motion` 下全部动效降级为静态
- [ ] 后台日志行错误码与会话 ID 与前台一致

---

*本文档为前台分册 §4.9 的深度展开，规格与 `assistant-front.html` 实际实现同源；如页面气泡基类调整，本文 §2 基线表须同步更新。*
