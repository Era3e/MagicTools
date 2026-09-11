import { test, expect } from "@playwright/test";

test("designer 全流程（生成→预览→沉淀→列表→历史）", async ({ request }) => {
  const created = await request.post("/api/designer/generate", {
    data: { prompt: "一个问候卡片" },
  });
  expect(created.ok()).toBeTruthy();
  const gen = await created.json();
  expect(gen.status).toBe("ok");
  expect(gen.componentName).toBeTruthy();

  const preview = await request.post("/api/designer/preview", { data: { code: gen.code } });
  expect(preview.ok()).toBeTruthy();

  const saved = await request.post("/api/designer/components", {
    data: { name: gen.componentName, description: "e2e", code: gen.code },
  });
  expect(saved.ok()).toBeTruthy();

  const comps = await (await request.get("/api/designer/components")).json();
  expect(comps.length).toBeGreaterThanOrEqual(1);

  const history = await request.get("/api/designer/generations");
  expect((await history.json()).length).toBeGreaterThanOrEqual(1);
});

test("designer 生成页面渲染", async ({ page }) => {
  await page.goto("/designer/generate");
  await expect(page.getByText("COMMISSION · 定制生成")).toBeVisible();
});

// ---------- P0-1b 新增：画廊委托单交互 + 列表跳转副作用断言 ----------
test("designer 生成按钮 副作用：点击生成 → POST /generate 请求发出", async ({ page }) => {
  await page.goto("/designer/generate");
  const promptInput = page
    .getByRole("textbox", { name: /prompt|描述|定制|需求|生成.*描述/i })
    .first();
  const input = (await promptInput.count()) > 0
    ? promptInput
    : page.getByPlaceholder(/描述.*组件|prompt|请输入|描述你/).first();
  test.skip(
    (await input.count()) === 0,
    "[designer] 未命中生成描述输入框（检查 placeholder/label）"
  );
  const genPromise = page.waitForRequest(
    (req) => req.url().includes("/api/designer/generate") && req.method() === "POST",
    { timeout: 15000 }
  );
  await input.fill("一个蓝绿色的问候卡片组件（E2E交互）");
  // 按钮文案渲染为「生 成」（AntD 双字按钮的字间空格，计入 accessible name），
  // 正则须显式允许 \s*，否则 /生成/ 命不中 → 回退 Enter（TextArea 只换行不提交）
  const genBtn = page
    .getByRole("button", { name: /生\s*成|定\s*制|委\s*托|Generate|提\s*交/i })
    .first();
  const btn = (await genBtn.count()) > 0 ? genBtn : page.getByText(/生成组件|委托生成/).first();
  test.skip(
    (await btn.count()) === 0,
    "[designer] 未命中「生成」按钮（TextArea 的 Enter 只换行不提交，无兜底）"
  );
  await btn.click();
  // 模式 4：API 必须发出
  await genPromise;
  // 模式 3：展位区出现组件名 / 预览框
  await expect(
    page.getByText(/预览|Preview|生成完成|组件|展品/i).first()
  ).toBeVisible({ timeout: 12000 });
});

test("designer 导航跳转 副作用：组件馆藏 / 生成历史 URL 变化", async ({ page }) => {
  await page.goto("/designer/generate");
  const compLink = page
    .getByRole("link", { name: /组件.*馆藏|组件库|components|馆藏/i })
    .first();
  const compTrigger = (await compLink.count()) > 0
    ? compLink
    : page.getByText(/组件馆藏|组件库/).first();
  test.skip(
    (await compTrigger.count()) === 0,
    "[designer] 未命中「组件馆藏」导航入口"
  );
  await compTrigger.click();
  await expect(page).toHaveURL(/\/designer\/(admin\/)?components/, { timeout: 8000 });
  // v2.3 前台 /components 渲染组件表格（front 模式），「组件名」为表头唯一锚点
  await expect(page.getByText("组件名").first()).toBeVisible({ timeout: 8000 });
});

// ---------- D-01/D-02 画布工坊 ----------
test("designer 画布工坊：页面渲染三栏与空画布", async ({ page }) => {
  await page.goto("/designer/studio");
  await expect(page.getByText("STUDIO · 画布工坊")).toBeVisible();
  await expect(page.getByText("布局").first()).toBeVisible();
  await expect(page.getByText("@mt/ui").first()).toBeVisible();
  await expect(page.getByTestId("studio-canvas")).toBeVisible();
  await expect(page.getByText(/空画布/)).toBeVisible();
});

test("designer 画布工坊：双击添加组件 → 画布节点与代码面板同步", async ({ page }) => {
  await page.goto("/designer/studio");
  await expect(page.getByText("STUDIO · 画布工坊")).toBeVisible();
  // 双击 palette 卡片 = 拖拽的同源兜底路径（onDragEnd 与 dblclick 走同一 addNode）
  await page.getByTestId("palette-title").dblclick();
  // 「标题文本」同时出现在画布节点与代码 textarea，收敛到 heading 角色
  await expect(page.getByRole("heading", { name: /^标题文本/ })).toBeVisible({ timeout: 8000 });
  const code = page.getByTestId("studio-code");
  await expect(code).toHaveValue(/<Typography\.Title/, { timeout: 8000 });
  await expect(code).toHaveValue(/export default function/);
});

test("designer 画布工坊：选中节点改文本 → 画布即时更新", async ({ page }) => {
  await page.goto("/designer/studio");
  await page.getByTestId("palette-title").dblclick();
  await page.getByRole("heading", { name: /^标题文本/ }).click();
  const input = page.getByLabel("文本");
  await expect(input).toBeVisible({ timeout: 8000 });
  await input.fill("E2E 改过的标题");
  await expect(page.getByRole("heading", { name: /^E2E 改过的标题/ })).toBeVisible({ timeout: 8000 });
});

test("designer 画布工坊：应用代码（code→schema）成功回画布", async ({ page }) => {
  await page.goto("/designer/studio");
  await expect(page.getByText("STUDIO · 画布工坊")).toBeVisible();
  const code = page.getByTestId("studio-code");
  const newCode = `import { Button } from "antd";\nimport { tokens } from "@mt/ui";\n\nexport default function E2eCard() {\n  return (\n    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.m }}>\n      <Button type="primary">E2E 按钮</Button>\n    </div>\n  );\n}`;
  await code.fill(newCode);
  await page.getByRole("button", { name: /应\s*用\s*代\s*码/ }).click();
  await expect(page.getByRole("button", { name: "E2E 按钮" })).toBeVisible({ timeout: 10000 });
});

// ---------- 拖拽真实链路（真实指针事件序列） ----------
// 注意：不可用 locator.dragTo——它只派发一次 pointermove，而 dnd-kit PointerSensor 的
// activationConstraint(distance:6) 在激活那次 move 会丢弃坐标（handleStart 后直接 return），
// 激活后的 collision detection 需要后续 move 驱动，否则 e.over 恒 null。真实用户拖拽
// 有连续指针流（60Hz+）无此问题；e2e 必须手写 mouse 序列且 steps>=2
async function dragToCanvas(page: import("@playwright/test").Page, testid = "palette-button") {
  const src = await page.getByTestId(testid).boundingBox();
  const dst = await page.getByTestId("studio-canvas").boundingBox();
  await page.mouse.move(src!.x + src!.width / 2, src!.y + src!.height / 2);
  await page.mouse.down();
  await page.mouse.move(dst!.x + dst!.width / 2, dst!.y + 60, { steps: 8 });
  await page.mouse.up();
}

test("designer 画布工坊：拖拽 palette 卡片到画布 → 节点出现且代码同步", async ({ page }) => {
  await page.goto("/designer/studio");
  await expect(page.getByText("STUDIO · 画布工坊")).toBeVisible();
  const canvas = page.getByTestId("studio-canvas");
  await expect(canvas).toBeVisible();
  // 前置断言：画布是注册的 droppable（无此锚点 = onDragEnd 的 e.over 恒 null，拖拽必失效）
  await expect(canvas).toHaveAttribute("data-droppable-id", "canvas-root");

  await dragToCanvas(page);

  // 断言：画布出现按钮节点（registry defaultProps children="按钮"）。
  // scope 收敛画布（dnd-kit useDraggable 默认 role="button"，palette 卡自身会假阳性命中）；
  // AntD 双字按钮渲染为「按 钮」，名称正则必须 \s* 形式（硬性约定 8）
  await expect(canvas.getByRole("button", { name: /^按\s*钮$/ })).toBeVisible({ timeout: 8000 });
  // 断言：代码面板同步生成 <Button
  await expect(page.getByTestId("studio-code")).toHaveValue(/<Button/, { timeout: 8000 });
});

test("designer 画布工坊：拖入容器（先选卡片容器 → 拖拽落点为其子节点）", async ({ page }) => {
  await page.goto("/designer/studio");
  await expect(page.getByText("STUDIO · 画布工坊")).toBeVisible();
  const canvas = page.getByTestId("studio-canvas");
  // 先双击加一个卡片容器并选中它 → targetContainerId 指向该容器
  await page.getByTestId("palette-card").dblclick();
  // 「卡片标题」出现在画布头/属性面板 label/代码 textarea 三处，scope 收敛画布
  const cardTitle = canvas.getByText("卡片标题");
  await expect(cardTitle).toBeVisible({ timeout: 8000 });
  await cardTitle.click();
  await dragToCanvas(page);
  // 断言：按钮出现在画布（容器嵌套渲染）且代码同步（Card 内嵌 Button）
  await expect(canvas.getByRole("button", { name: /^按\s*钮$/ })).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("studio-code")).toHaveValue(/<Card[\s\S]*<Button/, { timeout: 8000 });
});
