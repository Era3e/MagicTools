import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequirementList from "./RequirementList";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("RequirementList", () => {
  it.each(["too-large", "read-error"])("更换无效文件 %s 后不能确认旧候选", async (failure) => {
    const preview = { id: "old-batch", revision: 1, status: "previewed", repository: "https://github.com/Era3e/MagicTools", sourceCommit: "a".repeat(40),
      counts: { baseline: 1, planned: 0, new: 1, duplicate: 0, conflict: 0 }, result: null,
      candidates: [{ candidate_id: "OLD-001", record_kind: "baseline", project: "manager", title: "旧候选",
        description: "旧内容", disposition: "new", evidence: [], acceptance_criteria: [], verification_gaps: [], depends_on: [] }] };
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) =>
      new Response(JSON.stringify(String(url).endsWith("/preview") ? preview : []), { status: 200 })));
    render(<MemoryRouter><RequirementList /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "导入候选" }));
    fireEvent.change(screen.getByRole("textbox", { name: "候选 JSON" }), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "预览候选" }));
    await screen.findByText("旧候选");
    const confirm = await screen.findByRole("button", { name: "确认导入选中项" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    const file = new File([failure === "too-large" ? "x".repeat(91 * 1024) : "{}"], "new.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: () => Promise.reject(new Error("读取文件失败")) });
    fireEvent.change(screen.getByLabelText("选择候选 JSON 文件"), { target: { files: [file] } });
    await screen.findByText(/文件超过|读取文件失败/);
    expect(confirm.disabled).toBe(true);
    expect(screen.queryByText("旧候选")).toBeNull();
  });

  it("先预览候选，再由用户确认导入", async () => {
    const preview = { id: "batch-1", revision: 1, status: "previewed", repository: "https://github.com/Era3e/MagicTools", sourceCommit: "a".repeat(40),
      counts: { baseline: 1, planned: 1, new: 2, duplicate: 0, conflict: 0 }, result: null,
      candidates: [
        { candidate_id: "B-1", record_kind: "baseline", project: "manager", title: "示例能力", description: "已有行为",
          disposition: "new", evidence: [], acceptance_criteria: [], verification_gaps: [], depends_on: [] },
        { candidate_id: "P-1", record_kind: "planned", project: "manager", title: "示例规划", description: "待开发行为",
          disposition: "new", evidence: [], acceptance_criteria: ["结果正确"], verification_gaps: [], depends_on: [] },
      ] };
    const fetcher = vi.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify(
      String(url).endsWith("/preview") ? preview : String(url).endsWith("/confirm")
        ? { batchId: "batch-1", created: { baseline: 1, planned: 1 }, targets: [] }
        : String(url).includes("/import-batches/") ? { ...preview, status: "confirmed" } : []
    ), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<MemoryRouter><RequirementList /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "导入候选" }));
    fireEvent.change(screen.getByRole("textbox", { name: "候选 JSON" }), { target: { value: '{"records":[]}' } });
    fireEvent.click(screen.getByRole("button", { name: "预览候选" }));
    await screen.findByText("示例能力");
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith("/confirm"))).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: "确认导入选中项" }));
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).endsWith("/confirm"))).toBe(true));
    await screen.findByText(/导入完成：能力基线 1 条，规划需求 1 条/);
  });

  it("渲染需求列表与状态标签", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { id: "r1", title: "批量导出需求", description: "", source: "assessor", sourceRef: "", sourcePayload: null, status: "waiting", priority: "P1", iterationId: null, branch: "", prUrl: "", labels: ["assessor"], timeline: [], updatedAt: "2026-08-19T00:00:00Z" },
          ]),
          { status: 200 }
        )
      )
    );
    render(
      <MemoryRouter>
        <RequirementList />
      </MemoryRouter>
    );
    expect(await screen.findByText("批量导出需求")).toBeTruthy();
    expect(screen.getByText("待分析")).toBeTruthy();
    expect(screen.getByText("Assessor")).toBeTruthy();
  });
});
