# D-15 投递日历实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Applicant 前台新增「投递日历」页（跨岗位月历/时间线 + KPI + 待跟进），支持计划面试（未来时间、可改期/标记完成），positions 补 applied_at 投递时间戳。

**Architecture:** 轻量 schema 扩展（migration 002）+ applicant-server 三处 API 扩展（跨岗位面试列表 / 面试 status / appliedAt）+ 前端新页 CalendarPage（手写 CSS Grid 月历，零外部日历库）与 InterviewForm/InterviewPage/PositionDetail 适配。设计 spec：`docs/superpowers/specs/2026-09-10-applicant-calendar-design.md`。

**Tech Stack:** NestJS 10 + pg 原生 SQL + Zod（server）；React 18 + AntD 5 + @mt/ui（web）；vitest（单测/e2e.test）+ Playwright（e2e）。

**全局约定：**

- 本机 PowerShell：pnpm 一律 `pnpm.cmd`；
- 服务端 e2e 需 PostgreSQL（mt 库常规可用；库不可用时用例 `ctx.skip()` 落库即跳，既有模式）；
- 每任务完成即提交（Conventional Commits 中文 subject 动词开头 ≤50 字）；
- 数据构造统一用唯一公司名 `日历E2E公司${Date.now()}`（并发唯一键，禁 [0] 位置断言）。

---

## Task 1: migration 002 + positions.applied_at

**Files:**

- Create: `apps/applicant/server/migrations/002_delivery_calendar.sql`
- Modify: `apps/applicant/server/src/position.repo.ts`
- Test: `apps/applicant/server/src/position.e2e.test.ts`

- [ ] **Step 1: 写失败测试（appliedAt 自动落库与手动优先）**

在 `position.e2e.test.ts` 的 `describe("positions", ...)` 内（"非法状态返回 400" 用例之后）追加：

```typescript
  it("状态流转 applied 自动落 appliedAt 且手动值优先", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const created = await request(app.getHttpServer())
      .post("/api/applicant/positions")
      .send({ company: "日历E2E公司" + Date.now(), title: "日历测试岗" });
    const id = created.body.id as string;

    const first = await request(app.getHttpServer()).patch("/api/applicant/positions/" + id).send({ status: "applied" });
    expect(first.status).toBe(200);
    expect(first.body.appliedAt).toBeTruthy();

    const again = await request(app.getHttpServer()).patch("/api/applicant/positions/" + id).send({ status: "interview" });
    expect(again.body.appliedAt).toBe(first.body.appliedAt);

    const manual = await request(app.getHttpServer())
      .patch("/api/applicant/positions/" + id)
      .send({ appliedAt: "2026-09-01T08:00:00.000Z" });
    expect(manual.status).toBe(200);
    expect(manual.body.appliedAt).toBe("2026-09-01T08:00:00.000Z");
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: 新用例 FAIL（`appliedAt` undefined / 列不存在导致 500）

- [ ] **Step 3: 写 migration 002**

`apps/applicant/server/migrations/002_delivery_calendar.sql`：

```sql
ALTER TABLE positions ADD COLUMN IF NOT EXISTS applied_at timestamptz;

ALTER TABLE interviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'done';
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_status_check;
ALTER TABLE interviews ADD CONSTRAINT interviews_status_check CHECK (status IN ('scheduled','done'));
```

- [ ] **Step 4: 扩展 position.repo.ts**

`PositionInput` 增字段（`appliedUrl?: string;` 行后）：

```typescript
  appliedAt?: string | null;
```

`PositionRow` 增字段（`notes: string;` 行后）：

```typescript
  appliedAt: string | null;
```

`mapRow` 增（`notes: r.notes as string,` 行后）：

```typescript
    appliedAt: r.applied_at ? new Date(r.applied_at as string).toISOString() : null,
```

`createPosition` 的 INSERT 列与参数追加 `applied_at`（值 `input.appliedAt ?? null`，占位符顺延）。

`updatePosition` 整体替换为：

```typescript
export async function updatePosition(id: string, patch: Partial<PositionInput>): Promise<PositionRow | null> {
  const current = await getPosition(id);
  if (!current) return null;
  const merged: PositionRow = {
    ...current,
    ...patch,
    appliedAt: patch.appliedAt !== undefined ? patch.appliedAt ?? null : current.appliedAt,
  };
  if (patch.status === "applied" && !merged.appliedAt && patch.appliedAt === undefined) {
    merged.appliedAt = new Date().toISOString();
  }
  const rows = await pool.query(
    "UPDATE positions SET company=$1,title=$2,city=$3,salary=$4,source=$5,jd_raw=$6,jd_structured=$7,status=$8,applied_url=$9,notes=$10,applied_at=$11,updated_at=now() WHERE id=$12 RETURNING *",
    [merged.company, merged.title, merged.city, merged.salary, merged.source, merged.jdRaw, JSON.stringify(merged.jdStructured), merged.status, merged.appliedUrl, merged.notes, merged.appliedAt, id]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: PASS（既有用例 + 新用例全绿）

- [ ] **Step 6: 提交**

```bash
git add apps/applicant/server
git commit -m "新增 positions 投递时间列与自动落库规则"
```

---

## Task 2: interviews.status + 跨岗位列表 + PATCH 端点

**Files:**

- Modify: `apps/applicant/server/src/interview.repo.ts`
- Modify: `apps/applicant/server/src/interview.service.ts`
- Modify: `apps/applicant/server/src/interview.controller.ts`
- Test: `apps/applicant/server/src/interview.e2e.test.ts`

- [ ] **Step 1: 写失败测试（计划面试全链路 + 校验拒绝）**

在 `interview.e2e.test.ts` 文件尾部追加第二个 describe：

```typescript
describe("interviews · 计划面试（D-15）", () => {
  it("创建计划面试 → 跨岗位列表 → 改期 → 标记完成", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const company = "日历E2E公司" + Date.now();
    const pos = await request(app.getHttpServer())
      .post("/api/applicant/positions")
      .send({ company, title: "计划面试岗" });
    const scheduledAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const created = await request(app.getHttpServer())
      .post("/api/applicant/positions/" + pos.body.id + "/interviews")
      .send({ round: 2, status: "scheduled", happenedAt: scheduledAt });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("scheduled");
    expect(created.body.happenedAt).toBe(scheduledAt);

    const all = await request(app.getHttpServer()).get("/api/applicant/interviews");
    expect(all.status).toBe(200);
    const mine = all.body.find((i: { company: string }) => i.company === company);
    expect(mine.company).toBe(company);
    expect(mine.title).toBe("计划面试岗");
    expect(mine.status).toBe("scheduled");

    const moved = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const patched = await request(app.getHttpServer())
      .patch("/api/applicant/interviews/" + mine.id)
      .send({ happenedAt: moved });
    expect(patched.status).toBe(200);
    expect(patched.body.happenedAt).toBe(moved);

    const done = await request(app.getHttpServer())
      .patch("/api/applicant/interviews/" + mine.id)
      .send({ status: "done" });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("done");
  });

  it("校验拒绝：done 缺 qaNotes / 非法 status / 空 PATCH body", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const company = "日历E2E公司" + Date.now();
    const pos = await request(app.getHttpServer())
      .post("/api/applicant/positions")
      .send({ company, title: "校验岗" });

    const noNotes = await request(app.getHttpServer())
      .post("/api/applicant/positions/" + pos.body.id + "/interviews")
      .send({ round: 1, status: "done" });
    expect(noNotes.status).toBe(400);

    const created = await request(app.getHttpServer())
      .post("/api/applicant/positions/" + pos.body.id + "/interviews")
      .send({ round: 1, status: "scheduled" });
    expect(created.status).toBe(201);

    const badPatch = await request(app.getHttpServer())
      .patch("/api/applicant/interviews/" + created.body.id)
      .send({ status: "paused" });
    expect(badPatch.status).toBe(400);

    const emptyPatch = await request(app.getHttpServer())
      .patch("/api/applicant/interviews/" + created.body.id)
      .send({});
    expect(emptyPatch.status).toBe(400);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: FAIL（GET /interviews 404、PATCH 404、status 字段 undefined）

- [ ] **Step 3: interview.repo.ts 扩展**

`InterviewRow` 增字段（`analysis` 字段行后）：

```typescript
  status: "scheduled" | "done";
```

`mapRow` 增（`analysis:` 赋值行后）：

```typescript
    status: (r.status as "scheduled" | "done") ?? "done",
```

`createInterview` 替换为：

```typescript
export async function createInterview(
  positionId: string,
  input: { round: number; happenedAt?: string; qaNotes: string; reflection: string; status?: "scheduled" | "done" }
): Promise<InterviewRow> {
  const rows = await pool.query(
    "INSERT INTO interviews (position_id, round, happened_at, qa_notes, reflection, status) VALUES ($1,$2,COALESCE($3, now()),$4,$5,$6) RETURNING *",
    [positionId, input.round, input.happenedAt ?? null, input.qaNotes, input.reflection, input.status ?? "done"]
  );
  return mapRow(rows.rows[0]);
}
```

文件尾部新增：

```typescript
export interface InterviewWithPosition extends InterviewRow {
  company: string;
  title: string;
  positionStatus: string;
}

export async function listAllWithPosition(): Promise<InterviewWithPosition[]> {
  const rows = await pool.query(
    `SELECT i.*, p.company, p.title, p.status AS position_status
     FROM interviews i JOIN positions p ON p.id = i.position_id
     ORDER BY i.happened_at DESC`
  );
  return rows.rows.map((r: Record<string, unknown>) => ({
    ...mapRow(r),
    company: r.company as string,
    title: r.title as string,
    positionStatus: r.position_status as string,
  }));
}

export async function updateInterview(
  id: string,
  patch: { happenedAt?: string; status?: "scheduled" | "done" }
): Promise<InterviewRow | null> {
  const current = await getInterview(id);
  if (!current) return null;
  const happenedAt = patch.happenedAt ?? current.happenedAt;
  const status = patch.status ?? current.status;
  const rows = await pool.query(
    "UPDATE interviews SET happened_at=$2, status=$3 WHERE id=$1 RETURNING *",
    [id, happenedAt, status]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}
```

- [ ] **Step 4: interview.service.ts 校验层**

import 行 `@nestjs/common` 增补 `BadRequestException`；import `./interview.repo` 增补 `listAllWithPosition, updateInterview`；`InterviewService` 类内 `list` 方法后追加，并**删除原 `create` 方法**（被新签名替换）：

```typescript
  listAll() {
    return listAllWithPosition();
  }

  create(positionId: string, input: { round: number; happenedAt?: string; qaNotes?: string; reflection?: string; status?: "scheduled" | "done" }) {
    const status = input.status ?? "done";
    const qaNotes = input.qaNotes ?? "";
    if (status === "done" && !qaNotes.trim()) {
      throw new BadRequestException("已完成的面试必须填写问答记录");
    }
    return createInterview(positionId, { ...input, qaNotes, status });
  }

  async update(id: string, patch: { happenedAt?: string; status?: "scheduled" | "done" }) {
    if (patch.status && !["scheduled", "done"].includes(patch.status)) {
      throw new BadRequestException("非法面试状态: " + patch.status);
    }
    if (patch.happenedAt === undefined && patch.status === undefined) {
      throw new BadRequestException("至少提供 happenedAt 或 status 之一");
    }
    const row = await updateInterview(id, patch);
    if (!row) throw new NotFoundException("面试记录不存在");
    return row;
  }
```

- [ ] **Step 5: interview.controller.ts 路由**

import 行 `@nestjs/common` 增补 `Patch`；类内 `list` 方法后追加：

```typescript
  @Get("interviews")
  listAll() {
    return this.service.listAll();
  }

  @Patch("interviews/:id")
  update(@Param("id") id: string, @Body() body: { happenedAt?: string; status?: "scheduled" | "done" }) {
    return this.service.update(id, body);
  }
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm.cmd --filter @mt/applicant-server test`
Expected: PASS 全绿

- [ ] **Step 7: 提交**

```bash
git add apps/applicant/server
git commit -m "新增计划面试状态机与跨岗位面试接口"
```

---

## Task 3: 前端 api 层扩展

**Files:**

- Modify: `apps/applicant/web/src/api.ts`

- [ ] **Step 1: 类型与方法扩展**

`api.ts`：`Position` 接口 `updatedAt: string;` 前增：

```typescript
  appliedAt?: string | null;
```

`Interview` 接口 `analysis` 行前增：

```typescript
  status: "scheduled" | "done";
```

`Interview` 接口后新增：

```typescript
export interface InterviewWithPosition extends Interview {
  company: string;
  title: string;
  positionStatus: PositionStatus;
}
```

`api` 对象内 `listInterviews` 行后增：

```typescript
  listAllInterviews: () => request<InterviewWithPosition[]>("/interviews"),
  updateInterview: (id: string, patch: { happenedAt?: string; status?: "scheduled" | "done" }) =>
    request<Interview>("/interviews/" + id, { method: "PATCH", body: JSON.stringify(patch) }),
```

`createInterview` 替换为：

```typescript
  createInterview: (positionId: string, input: { round: number; happenedAt?: string; qaNotes?: string; reflection?: string; status?: "scheduled" | "done" }) =>
    request<Interview>("/positions/" + positionId + "/interviews", { method: "POST", body: JSON.stringify(input) }),
```

- [ ] **Step 2: 类型检查通过**

Run: `pnpm.cmd --filter @mt/applicant-web lint`
Expected: 0 错误

- [ ] **Step 3: 提交**

```bash
git add apps/applicant/web/src/api.ts
git commit -m "扩展前端接口层支持计划面试与投递时间"
```

---

## Task 4: InterviewForm 计划模式

**Files:**

- Modify: `apps/applicant/web/package.json`（dayjs 依赖）
- Modify: `apps/applicant/web/src/components/InterviewForm.tsx`
- Create: `apps/applicant/web/src/components/InterviewForm.test.tsx`

- [ ] **Step 1: 安装 dayjs**

```bash
pnpm.cmd --filter @mt/applicant-web add dayjs
```

- [ ] **Step 2: 写失败测试**

`apps/applicant/web/src/components/InterviewForm.test.tsx`：

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InterviewForm from "./InterviewForm";

describe("InterviewForm", () => {
  it("默认模式保存复盘需要问答记录", async () => {
    const onSubmit = vi.fn();
    render(<InterviewForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /保\s*存\s*复\s*盘/ }));
    expect(await screen.findByText("请输入问答记录")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("计划模式免填问答记录并携带 status 与时间", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<InterviewForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /记\s*为\s*计\s*划/ }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 10000 });
    const arg = onSubmit.mock.calls[0][0] as { status: string; happenedAt: string; qaNotes: string };
    expect(arg.status).toBe("scheduled");
    expect(arg.happenedAt).toBeTruthy();
    expect(arg.qaNotes).toBe("");
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm.cmd --filter @mt/applicant-web test`
Expected: FAIL（「记为计划」按钮不存在）

- [ ] **Step 4: 重写 InterviewForm**

```tsx
import { Button, DatePicker, Form, Input, InputNumber } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";

export interface InterviewSubmitValues {
  round: number;
  happenedAt: string;
  qaNotes: string;
  reflection: string;
  status: "scheduled" | "done";
}

export function InterviewForm(props: { onSubmit: (values: InterviewSubmitValues) => Promise<void> }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const submit = async (status: "scheduled" | "done") => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const at: Dayjs = (values.happenedAt as Dayjs | undefined) ?? dayjs();
      await props.onSubmit({
        round: values.round,
        happenedAt: at.toISOString(),
        qaNotes: status === "scheduled" ? "" : values.qaNotes,
        reflection: values.reflection ?? "",
        status,
      });
      form.resetFields();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="round" label="轮次" initialValue={1}>
        <InputNumber min={1} max={10} />
      </Form.Item>
      <Form.Item name="happenedAt" label="面试时间" initialValue={dayjs()}>
        <DatePicker showTime style={{ width: "100%" }} />
      </Form.Item>
      <Form.Item name="qaNotes" label="问答记录" rules={[{ required: true, message: "请输入问答记录" }]}>
        <Input.TextArea rows={6} placeholder="问了什么，我怎么答的" />
      </Form.Item>
      <Form.Item name="reflection" label="自我反思">
        <Input.TextArea rows={3} placeholder="哪里答得不好，为什么" />
      </Form.Item>
      <Button type="primary" loading={saving} onClick={() => submit("done")} style={{ marginRight: 12 }}>
        保存复盘
      </Button>
      <Button loading={saving} onClick={() => submit("scheduled")}>
        记为计划
      </Button>
    </Form>
  );
}
```

说明：原 htmlType="submit" 单按钮模式移除，双按钮走 onClick + validateFields；「保存复盘」/「记为计划」按钮无字间空格问题（四字/四字文案 AntD 不加空格，e2e 正则用 `\s*` 兜底已是惯例）。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm.cmd --filter @mt/applicant-web test`
Expected: PASS（新用例 + 既有用例；InterviewPage 的 onSubmit 收到扩展 values，`api.createInterview` 已是扩展签名（Task 3），无需改动）

- [ ] **Step 6: 提交**

```bash
git add apps/applicant/web
git commit -m "改造面试表单支持计划模式与时间录入"
```

---

## Task 5: InterviewPage scheduled 适配

**Files:**

- Modify: `apps/applicant/web/src/pages/InterviewPage.tsx`

- [ ] **Step 1: scheduled 条目渲染适配**

- import 区从 `@mt/ui` 增补 `MtStatusTag`；
- 条目头部（`第 {iv.round} 面` 所在 flex 行）标题位改为：

```tsx
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: MAG.display, fontSize: 17 }}>第 {iv.round} 面</span>
              {iv.status === "scheduled" ? (
                <MtStatusTag tone="warning" mono>待进行</MtStatusTag>
              ) : null}
            </span>
```

- 条目底部（原 `<AnalysisView .../>` 所在 `<div style={{ marginTop: 12 }}>` 容器）替换为：

```tsx
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
            {iv.status === "scheduled" ? (
              <Button
                size="small"
                onClick={async () => {
                  try {
                    await api.updateInterview(iv.id, { status: "done" });
                    message.success("已标记完成，可回填复盘内容");
                    refresh();
                  } catch (err) {
                    message.error(String(err));
                  }
                }}
              >
                标记完成
              </Button>
            ) : (
              <AnalysisView
                analysis={iv.analysis}
                onAnalyze={() => analyze(iv.id)}
                onExport={() => {
                  window.open(api.exportInterviewUrl(iv.id), "_blank");
                }}
              />
            )}
          </div>
```

- [ ] **Step 2: lint**

Run: `pnpm.cmd --filter @mt/applicant-web lint`
Expected: 0 错误

- [ ] **Step 3: 提交**

```bash
git add apps/applicant/web/src/pages/InterviewPage.tsx
git commit -m "面试复盘页支持计划条目标记完成"
```

---

## Task 6: CalendarPage 页面（核心）

**Files:**

- Create: `apps/applicant/web/src/pages/CalendarPage.tsx`
- Create: `apps/applicant/web/src/pages/calendar-view.ts`（纯函数：KPI/待跟进/事件/月格矩阵）
- Create: `apps/applicant/web/src/pages/CalendarPage.test.tsx`
- Modify: `apps/applicant/web/src/App.tsx`

- [ ] **Step 1: 写 calendar-view 纯函数**

`apps/applicant/web/src/pages/calendar-view.ts`：

```typescript
import type { InterviewWithPosition, Position } from "../api";

export interface CalendarEvent {
  date: string;
  kind: "applied" | "scheduled" | "interviewed";
  label: string;
  positionId: string;
}

export interface CalendarKpi {
  active: number;
  inInterview: number;
  upcoming7d: number;
  followUp: number;
}

export interface FollowUpItem {
  position: Position;
  days: number;
}

export const FOLLOW_UP_DAYS = 7;

const DAY_MS = 86_400_000;
const ymd = (iso: string) => iso.slice(0, 10);
const dayDiff = (a: string, b: string) => Math.floor((Date.parse(b) - Date.parse(a)) / DAY_MS);

export function buildEvents(positions: Position[], interviews: InterviewWithPosition[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const p of positions) {
    if (p.appliedAt) events.push({ date: ymd(p.appliedAt), kind: "applied", label: `投递 · ${p.company}`, positionId: p.id });
  }
  for (const i of interviews) {
    events.push({
      date: ymd(i.happenedAt),
      kind: i.status === "scheduled" ? "scheduled" : "interviewed",
      label: `第${i.round}面 · ${i.company}`,
      positionId: i.positionId,
    });
  }
  return events.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function computeKpi(positions: Position[], interviews: InterviewWithPosition[], now = new Date()): CalendarKpi {
  const active = positions.filter((p) => ["applied", "written", "interview"].includes(p.status)).length;
  const inInterview = positions.filter((p) => p.status === "interview").length;
  const upcoming7d = interviews.filter((i) => {
    if (i.status !== "scheduled") return false;
    const d = dayDiff(now.toISOString(), i.happenedAt);
    return d >= 0 && d <= 7;
  }).length;
  return { active, inInterview, upcoming7d, followUp: buildFollowUps(positions, interviews, now).length };
}

export function buildFollowUps(positions: Position[], interviews: InterviewWithPosition[], now = new Date()): FollowUpItem[] {
  return positions
    .filter((p) => {
      if (!p.appliedAt || p.status !== "applied") return false;
      if (dayDiff(p.appliedAt, now.toISOString()) <= FOLLOW_UP_DAYS) return false;
      return !interviews.some((i) => i.positionId === p.id);
    })
    .map((p) => ({ position: p, days: dayDiff(p.appliedAt!, now.toISOString()) }))
    .sort((a, b) => b.days - a.days);
}

export function monthMatrix(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
```

- [ ] **Step 2: 写失败测试**

`apps/applicant/web/src/pages/CalendarPage.test.tsx`：

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CalendarPage from "./CalendarPage";
import { buildEvents, computeKpi, buildFollowUps, monthMatrix } from "./calendar-view";
import type { InterviewWithPosition, Position } from "../api";

const now = new Date("2026-09-10T00:00:00Z");

function makePosition(overrides: Partial<Position>): Position {
  return {
    id: "p-" + Math.random().toString(36).slice(2, 8),
    company: "测试公司", title: "工程师", city: "", salary: "", source: "manual",
    status: "applied", jdRaw: "", notes: "", updatedAt: "2026-09-10T00:00:00Z",
    appliedAt: "2026-09-01T00:00:00Z", ...overrides,
  };
}

function makeInterview(positionId: string, overrides: Partial<InterviewWithPosition> = {}): InterviewWithPosition {
  return {
    id: "i-" + Math.random().toString(36).slice(2, 8), positionId, round: 1,
    happenedAt: "2026-09-15T10:00:00Z", qaNotes: "", reflection: "", analysis: null, status: "scheduled",
    company: "测试公司", title: "工程师", positionStatus: "interview", ...overrides,
  };
}

describe("calendar-view 纯函数", () => {
  it("投递、计划、已完成三类事件都进时间线且倒序", () => {
    const pos = makePosition({ appliedAt: "2026-09-01T00:00:00Z" });
    const ivs = [
      makeInterview(pos.id, { happenedAt: "2026-09-15T10:00:00Z" }),
      makeInterview(pos.id, { status: "done", happenedAt: "2026-09-05T10:00:00Z" }),
    ];
    const events = buildEvents([pos], ivs);
    expect(events.map((e) => e.kind)).toEqual(["scheduled", "interviewed", "applied"]);
  });

  it("KPI：在投/面试流程中/未来7天/待跟进", () => {
    const positions = [
      makePosition({ id: "a", status: "applied", appliedAt: "2026-09-01T00:00:00Z" }),
      makePosition({ id: "b", status: "interview", appliedAt: "2026-09-08T00:00:00Z" }),
      makePosition({ id: "c", status: "waiting", appliedAt: null }),
    ];
    const kpi = computeKpi(positions, [makeInterview("b")], now);
    expect(kpi).toEqual({ active: 2, inInterview: 1, upcoming7d: 1, followUp: 1 });
  });

  it("待跟进：超7天、applied、无面试记录", () => {
    const stale = makePosition({ id: "s", appliedAt: "2026-08-25T00:00:00Z" });
    const fresh = makePosition({ id: "f", appliedAt: "2026-09-09T00:00:00Z" });
    const withInterview = makePosition({ id: "w", appliedAt: "2026-08-25T00:00:00Z" });
    const items = buildFollowUps([stale, fresh, withInterview], [makeInterview("w")], now);
    expect(items.map((i) => i.position.id)).toEqual(["s"]);
    expect(items[0].days).toBeGreaterThanOrEqual(15);
  });

  it("月格矩阵：周一起始、月首补位、行完整", () => {
    const cells = monthMatrix(2026, 8);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe("2026-09-01");
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(Boolean).length).toBe(30);
  });
});

describe("CalendarPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("渲染报头、KPI 与默认月历视图", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );
    expect(await screen.findByText("投递日历")).toBeTruthy();
    expect(screen.getByText("在投")).toBeTruthy();
  });

  it("空数据展示空态引导", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );
    expect(await screen.findByText("还没有可展示的动态")).toBeTruthy();
  });
});
```

（月格矩阵断言依据：2026-09-01 是周二，周一起始历下 cells[0] 为补位 null、cells[1] 为当月 1 日；2026 年 9 月共 30 天）

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm.cmd --filter @mt/applicant-web test`
Expected: FAIL（CalendarPage 模块不存在）

- [ ] **Step 4: 实现 CalendarPage**

`apps/applicant/web/src/pages/CalendarPage.tsx`：

```tsx
import { Button, Segmented, Skeleton, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type InterviewWithPosition, type Position } from "../api";
import { MtEmptyState, MtKpiRow, MtStatusTag, tokens, useTheme } from "@mt/ui";
import { buildEvents, buildFollowUps, computeKpi, monthMatrix, type CalendarEvent } from "./calendar-view";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const KIND_LABEL: Record<CalendarEvent["kind"], string> = { applied: "投递", scheduled: "计划面试", interviewed: "已完成面试" };
const KIND_TONE: Record<CalendarEvent["kind"], "info" | "warning" | "neutral"> = { applied: "info", scheduled: "warning", interviewed: "neutral" };

export default function CalendarPage() {
  const navigate = useNavigate();
  const [positions, setPositions] = useState<Position[]>([]);
  const [interviews, setInterviews] = useState<InterviewWithPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"月历" | "时间线">("月历");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const theme = useTheme();
  const MAG = {
    ink: theme.ink,
    accent: theme.accent ?? theme.primary,
    tint: theme.tint ?? theme.paper ?? theme.background,
    muted: theme.muted,
    panel: theme.panel ?? theme.card ?? "#ffffff",
    border: theme.border ?? theme.rule,
    display: theme.displayFont,
    sans: theme.bodyFont,
  };

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([api.listPositions(), api.listAllInterviews()])
      .then(([ps, ivs]) => {
        setPositions(ps);
        setInterviews(ivs);
      })
      .catch((err) => message.error(String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const events = useMemo(() => buildEvents(positions, interviews), [positions, interviews]);
  const kpi = useMemo(() => computeKpi(positions, interviews), [positions, interviews]);
  const followUps = useMemo(() => buildFollowUps(positions, interviews), [positions, interviews]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [events]);
  const cells = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const todayYmd = new Date().toISOString().slice(0, 10);

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const openEvent = (e: CalendarEvent) => {
    navigate(e.kind === "applied" ? `/positions/${e.positionId}` : `/positions/${e.positionId}/interviews`);
  };

  return (
    <div className="pg-calendar" style={{ fontFamily: MAG.sans, color: MAG.ink, display: "flex", flexDirection: "column", gap: tokens.spacing.lg }}>
      <style>{`
@media (max-width: 920px) {
  .pg-calendar .pg-cal-hero { grid-template-columns: minmax(0, 1fr) !important; }
  .pg-calendar .pg-cal-events { display: none !important; }
}
@media (max-width: 640px) {
  .pg-calendar .pg-cal-cell { min-height: 44px !important; }
  .pg-calendar .pg-cal-marks span:nth-child(n+3) { display: none; }
}
`}</style>

      <section
        className="pg-cal-hero"
        style={{
          background: MAG.tint,
          borderRadius: tokens.radiusTokens.lg,
          padding: `${tokens.spacing.xl}px ${tokens.spacing.lg}px`,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(200px, 1fr)",
          gap: tokens.spacing.lg,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontFamily: tokens.font.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: MAG.accent, fontWeight: 600, marginBottom: 8 }}>
            CALENDAR · 投递日历
          </div>
          <h1 style={{ margin: "0 0 10px", fontFamily: MAG.display, fontSize: 34, fontWeight: 600, lineHeight: 1.2 }}>
            每一次投递与面试，都在一张日历上
          </h1>
          <p style={{ margin: 0, color: MAG.muted, fontSize: 14, lineHeight: 1.75 }}>
            跨岗位的投递节奏、面试安排与待跟进信号，一览无余。
          </p>
        </div>
        <MtKpiRow
          items={[
            { label: "在投", value: kpi.active },
            { label: "面试流程中", value: kpi.inInterview },
            { label: "未来 7 天面试", value: kpi.upcoming7d },
            { label: "待跟进", value: kpi.followUp },
          ]}
        />
      </section>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Segmented value={view} onChange={(v) => setView(v as "月历" | "时间线")} options={["月历", "时间线"]} />
        {view === "月历" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: tokens.font.mono, fontSize: 13 }}>
            <Button size="small" onClick={() => shiftMonth(-1)}>‹</Button>
            <span data-testid="cal-month-label" style={{ minWidth: 96, textAlign: "center" }}>
              {cursor.year} 年 {cursor.month + 1} 月
            </span>
            <Button size="small" onClick={() => shiftMonth(1)}>›</Button>
            <Button size="small" type="text" onClick={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); }}>
              回到本月
            </Button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : events.length === 0 ? (
        <MtEmptyState
          title="还没有可展示的动态"
          description="投递岗位或记录面试后，日历会自动汇集"
          actionText="去岗位博览"
          onAction={() => navigate("/positions")}
        />
      ) : view === "月历" ? (
        <div style={{ background: MAG.panel, border: `1px solid ${MAG.border}`, borderRadius: tokens.radiusTokens.lg, padding: tokens.spacing.lg }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginBottom: 8 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ textAlign: "center", fontFamily: tokens.font.mono, fontSize: 11, color: MAG.muted, padding: "4px 0" }}>
                {w}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
            {cells.map((date, idx) => {
              if (!date) {
                return <div key={"pad" + idx} style={{ minHeight: 72, borderRadius: tokens.radius, background: "rgba(0,0,0,0.02)" }} />;
              }
              const dayEvents = eventsByDate.get(date) ?? [];
              const isToday = date === todayYmd;
              return (
                <div
                  key={date}
                  className="pg-cal-cell"
                  data-testid="cal-cell"
                  style={{
                    minHeight: 72,
                    padding: 6,
                    borderRadius: tokens.radius,
                    border: `1px solid ${isToday ? MAG.accent : MAG.border}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    cursor: dayEvents.length ? "pointer" : "default",
                  }}
                  onClick={() => dayEvents[0] && openEvent(dayEvents[0])}
                  title={dayEvents.map((e) => e.label).join(" / ") || undefined}
                >
                  <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: isToday ? MAG.accent : MAG.muted, alignSelf: "flex-end" }}>
                    {Number(date.slice(8))}
                  </span>
                  <div className="pg-cal-marks" style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {dayEvents.map((e, i) => (
                      <span
                        key={e.kind + i}
                        title={e.label}
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          display: "inline-block",
                          background: e.kind === "applied" ? MAG.accent : e.kind === "scheduled" ? tokens.color.warning : MAG.ink,
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pg-cal-events" style={{ display: "flex", gap: 16, marginTop: 12, fontFamily: tokens.font.mono, fontSize: 11, color: MAG.muted, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: MAG.accent, display: "inline-block" }} />投递
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: tokens.color.warning, display: "inline-block" }} />计划面试
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: MAG.ink, display: "inline-block" }} />已完成面试
            </span>
          </div>
        </div>
      ) : (
        <div style={{ background: MAG.panel, border: `1px solid ${MAG.border}`, borderRadius: tokens.radiusTokens.lg, padding: tokens.spacing.lg }}>
          {events.map((e) => (
            <div
              key={e.date + e.kind + e.positionId}
              data-testid="cal-timeline-item"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${MAG.border}`, cursor: "pointer" }}
              onClick={() => openEvent(e)}
            >
              <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: MAG.muted, minWidth: 96 }}>{e.date}</span>
              <MtStatusTag tone={KIND_TONE[e.kind]} mono>{KIND_LABEL[e.kind]}</MtStatusTag>
              <span style={{ fontSize: 13 }}>{e.label}</span>
            </div>
          ))}
        </div>
      )}

      {followUps.length > 0 ? (
        <section style={{ background: MAG.panel, border: `1px solid ${MAG.border}`, borderRadius: tokens.radiusTokens.lg, padding: tokens.spacing.lg }}>
          <div style={{ fontFamily: MAG.display, fontSize: 13, letterSpacing: 2, color: MAG.accent, marginBottom: 10 }}>FOLLOW-UP · 待跟进</div>
          {followUps.map(({ position, days }) => (
            <div key={position.id} data-testid="cal-followup-item" style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: `1px solid ${MAG.border}` }}>
              <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: tokens.color.warning }}>已等 {days} 天</span>
              <span style={{ fontSize: 13 }}>{position.company} · {position.title}</span>
              <Button size="small" type="text" style={{ marginLeft: "auto", color: MAG.muted }} onClick={() => navigate(`/positions/${position.id}`)}>
                查看 →
              </Button>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
```

取色说明：`MAG.panel` fallback `"#ffffff"` 沿用 PositionWall 同位置既有写法（`theme.panel ?? theme.card ?? "#ffffff"`，ESLint 豁免清单已覆盖该模式）；月格补位 `rgba(0,0,0,0.02)` 为中性透明叠加非色相硬编码，若 lint 拦截则改用 `tokens.color.bg`。

- [ ] **Step 5: App.tsx 接线**

- import 区增 `import CalendarPage from "./pages/CalendarPage";`
- `USER_NAV` 替换为：

```typescript
const USER_NAV = [
  { key: "/positions", label: "岗位博览" },
  { key: "/calendar", label: "投递日历" },
  { key: "/resumes", label: "简历工坊" },
];
```

- `UserRoutes` 内 `/resumes` 路由前增：

```tsx
      <Route path="/calendar" element={<CalendarPage />} />
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm.cmd --filter @mt/applicant-web test`
Expected: PASS 全绿（含 App.test.tsx 既有用例）

- [ ] **Step 7: lint**

Run: `pnpm.cmd --filter @mt/applicant-web lint`
Expected: 0 错误

- [ ] **Step 8: 提交**

```bash
git add apps/applicant/web/src
git commit -m "新增投递日历页与跨岗位时间线"
```

---

## Task 7: PositionDetail 投递信息行

**Files:**

- Modify: `apps/applicant/web/src/pages/PositionDetail.tsx`

- [ ] **Step 1: 信息行补充**

信息行（`{item.city ? <span>📍 {item.city}</span> : null}` 所在 flex 容器，`来源 · {item.source}` 之前）增：

```tsx
          {item.appliedAt ? <span>投递于 {item.appliedAt.slice(0, 10)}</span> : null}
```

- [ ] **Step 2: lint**

Run: `pnpm.cmd --filter @mt/applicant-web lint`
Expected: 0 错误

- [ ] **Step 3: 全量单测验收**

Run: `pnpm.cmd --filter @mt/applicant-server test && pnpm.cmd --filter @mt/applicant-web test`
Expected: 全部 PASS

- [ ] **Step 4: 提交**

```bash
git add apps/applicant/web/src/pages/PositionDetail.tsx
git commit -m "补岗位详情投递时间展示"
```

---

## Task 8: Playwright e2e 用例

**Files:**

- Modify: `e2e/tests/applicant.spec.ts`

- [ ] **Step 1: 写 e2e 用例（锚点对照源码已实证）**

文件尾部追加：

```typescript
// ---------- D-15 投递日历 ----------
test("applicant 投递日历页渲染与时间线事件", async ({ page, request }) => {
  const company = "日历E2E公司" + Date.now();
  const created = await request.post("/api/applicant/positions", {
    data: { company, title: "日历工程师" },
  });
  expect(created.ok()).toBeTruthy();
  const pos = await created.json();
  const patched = await request.patch("/api/applicant/positions/" + pos.id, { data: { status: "applied" } });
  expect((await patched.json()).appliedAt).toBeTruthy();

  await page.goto("/applicant/calendar");
  await expect(page.getByText("投递日历").first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("在投").first()).toBeVisible();

  await page.getByRole("radio", { name: "时间线" }).click();
  const timeline = page.locator('[data-testid=cal-timeline-item]', { hasText: company });
  await expect(timeline.first()).toBeVisible({ timeout: 8000 });
  await expect(timeline).toContainText("投递");
});
```

（AntD Segmented 选项渲染为 radio 角色；`{ hasText: company }` 按唯一公司名过滤并发竞态——禁 [0] 位置断言纪律）

- [ ] **Step 2: 本地带桩全链路跑**

前置：`node infra/scripts/start-services.mjs`（如服务未起，带桩环境）
Run: `pnpm.cmd e2e -- --grep "投递日历"`
Expected: 1 passed / 0 skipped / 0 failed

- [ ] **Step 3: 提交**

```bash
git add e2e/tests/applicant.spec.ts
git commit -m "新增投递日历端到端用例"
```

---

## Task 9: 视觉基线与响应式纳管

**Files:**

- Modify: `e2e/fixtures/pages.ts`

- [ ] **Step 1: PAGES 清单增页**

`PAGES` 数组 `front-applicant-position-wall` 项后插：

```typescript
  {
    name: "front-applicant-calendar",
    path: "/applicant/calendar",
    anchor: /投递日历|CALENDAR/,
  },
```

- [ ] **Step 2: 本地清库 + 重生成 win32 基线**

```bash
docker exec <pg容器名> psql -U postgres -c "TRUNCATE positions CASCADE" -d applicant
pnpm.cmd build
node infra/scripts/start-services.mjs
pnpm.cmd e2e:visual:update
pnpm.cmd e2e:visual
```

（基线生成前必须清库——空库态与 CI 比对口径对齐，既有教训；USER_NAV 加项后 position-wall 基线必然漂移，全量重生成）
Expected: 17 张基线重生成，17/17 PASS

- [ ] **Step 3: responsive 巡检**

Run: `pnpm.cmd --filter @mt/e2e exec playwright test responsive.spec.ts`
Expected: 34/34 PASS（375/768 × 17 页）

- [ ] **Step 4: 提交**

```bash
git add e2e/fixtures/pages.ts e2e/snapshots
git commit -m "纳管投递日历视觉基线至十七页"
```

---

## Task 10: qa:gate + 文档收尾 + 0 bug loop

**Files:**

- Modify: `docs/superpowers/coverage-matrix.md`（A14 行）
- Modify: `docs/memory/mvp-deferred.md`（D-15 → ✅）
- Modify: `docs/CHANGELOG.md`、`docs/CODE_WIKI.md`、`docs/memory/state.md`

- [ ] **Step 1: qa:gate 全绿**

Run: `pnpm.cmd qa:gate`
Expected: lint 0 err / build / test / coverage / infra（docs-guard ✅ 行路径校验）/ docs 0 err 全绿

- [ ] **Step 2: coverage-matrix A14 行**

第 1 章表格尾部增（实际实现文件列带仓库全路径——drift guard 校验 ✅ 行路径存在性）：

```markdown
| A14 | D-15 投递日历（跨岗位月历/时间线 + KPI + 待跟进 + 计划面试） | mvp-deferred D-15 | apps/applicant/web/src/pages/CalendarPage.tsx + apps/applicant/web/src/pages/calendar-view.ts + apps/applicant/server/src/interview.repo.ts + apps/applicant/server/migrations/002_delivery_calendar.sql | ✅ 已实现（D-15 兑现） | applicant.spec.ts 投递日历用例 |
```

- [ ] **Step 3: mvp-deferred D-15 → ✅**

D-15 行降级说明列改（PR 号以实际开出为准回填）：

```markdown
✅ 2026-09-10 兑现：投递日历页（月历/时间线双视图 + KPI + 待跟进）+ 计划面试（scheduled/done 状态机）+ applied_at 自动落库
```

建议优先级列改 `✅ P2 已完成`，依赖条件列改 `—`；统计摘要真延期 4→3、下一迭代建议移除 D-15。

- [ ] **Step 4: CHANGELOG 条目（changeset 按 #54 经验跳过——applicant 双包为私有包，纯私有 changeset 需事后清理，平台 CHANGELOG 条目已足够）**

`docs/CHANGELOG.md` 追加 2026-09-10 节条目：

```markdown
- **D-15 投递日历落地（PR #xx，squash 合并）**：Applicant 前台新增「投递日历」——跨岗位月历/时间线双视图（投递/计划面试/已完成面试三类事件标记）、KPI 读数（在投/面试流程中/未来 7 天面试/待跟进）、待跟进清单（投递超 7 天无进展）；interviews 补 scheduled/done 状态机（计划面试可改期/标记完成）、positions 补 applied_at（status→applied 自动落库，手动值优先）；视觉基线 16→17 张、responsive 巡检纳管新页。
```

- [ ] **Step 5: CODE_WIKI §6.1 同步**

- 关键路由清单增两行：`GET /api/applicant/interviews` — 跨岗位面试列表（JOIN positions）；`PATCH /api/applicant/interviews/:id` — 计划面试改期/标记完成；
- 前端路由块 `/positions` 行后增：`/calendar — CalendarPage 投递日历（月历/时间线 + KPI + 待跟进）`。

- [ ] **Step 6: state.md 更新**

当前状态快照增 D-15 落地条目（关键决策：「记为计划」双按钮交互、7 天待跟进阈值常量化 FOLLOW_UP_DAYS、月历零外部库手写实现、基线 17 张流程）。

- [ ] **Step 7: 0 bug loop 独立验收**

由独立测试代理（新会话）验收：静态取证 + 动态复跑（qa:gate / e2e 全量 / 视觉 17 张 / responsive 34）+ 篡改测试（如 calendar-view.ts 的 FOLLOW_UP_DAYS 7→9 应使待跟进用例红）。验收记录填入 PR body。

- [ ] **Step 8: 提交 + 推送 + 开 PR**

```bash
git add docs
git commit -m "同步投递日历沉淀层文档"
git push -u origin feat-applicant-d15-calendar
```

PR body 必含两项勾选：`[x] **0 bug loop 验收记录**`（验收表格）与 `[x] **沉淀层文档已同步**`。CI 三段绿后 squash 合并；合并后 dispatch visual-baseline workflow 重生成 linux 基线（17 张）。

---

## Self-Review 记录

1. **Spec 覆盖**：§2 数据模型→Task 1/2；§3 API 四项→Task 1（3.4）/Task 2（3.1-3.3）；§4 前端六小节→Task 3（4.6）/Task 4（4.3）/Task 5（4.4）/Task 6（4.1/4.2）/Task 7（4.5）；§5 规范遵循→Task 6 内联说明；§6 测试四层→Task 1/2/4/6/8/9；§7 文档收尾→Task 10。无遗漏。
2. **占位符扫描**：无 TBD/TODO/「稍后实现」类占位；Task 10 PR 号 `#xx` 为流程事实（PR 未开出），合入前回填。
3. **类型一致性**：`InterviewSubmitValues`（Task 4）与 `api.createInterview` 扩展签名（Task 3）字段一致；`InterviewWithPosition` server 侧（Task 2：qaNotes/reflection/analysis/status + company/title/positionStatus）与 web 侧（Task 3 同构）一致；`calendar-view.ts` 四导出在测试与页面引用一致；`FOLLOW_UP_DAYS` 常量与 7 天阈值语义一致。
4. **已知风险**：AntD DatePicker 在 jsdom 的 validateFields 微任务链——计划模式用例已显式 `{ timeout: 10000 }`（CI 慢机纪律）；e2e Segmented radio 定位若 AntD 版本渲染差异，降级用 `getByText("时间线")`。
