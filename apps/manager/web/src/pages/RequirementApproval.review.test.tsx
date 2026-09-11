import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { message } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Requirement, type ContentRevision, type ApprovalEvent } from "../api";
import RequirementContentPanel from "./RequirementContentPanel";
import RequirementContentEditor from "./RequirementContentEditor";
import RequirementHistory from "./RequirementHistory";
import RequirementDetail from "./RequirementDetail";
import { contentFromRequirement } from "./RequirementContentView";

vi.mock("../api", () => ({ api: {
  getRequirement: vi.fn(), patchRequirement: vi.fn(), refreshPr: vi.fn(),
  getApprovalPolicy: vi.fn(), approveRevision: vi.fn(), revokeApproval: vi.fn(),
  getRequirementRevisions: vi.fn(), getApprovalHistory: vi.fn(),
} }));

const requirement: Requirement = {
  id: "review-a", revision: 8, contentRevision: 3, approvedContentRevision: null,
  approvalStatus: "unapproved", approvalReadiness: { ready: true, missing: [] },
  title: "待审需求 A", description: "需要保留的原始目标", project: "manager", scope: "原始范围", risk: "medium",
  acceptanceCriteria: ["验收条件 A"], dependencyRefs: ["P07"],
  evidenceRefs: [{ path: "apps/manager/server/src/app.module.ts", line: 1, url: "https://github.com/Era3e/MagicTools/blob/main/apps/manager/server/src/app.module.ts#L1" }],
  automationPolicy: "manual", source: "manual", sourceRef: "", sourcePayload: null, status: "designing", priority: "P2",
  branch: "", prUrl: "", iterationId: null, labels: [], timeline: [], updatedAt: "2026-09-11T00:00:00Z", allowedNextStatuses: ["todo"],
};
const policy = { configured: true, actorId: "owner-review", authMethod: "owner-token", automatedExecutionEnabled: false as const };
const credential = "test-review-only-credential-not-for-production";
const disabled = (name: string) => (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;
const secret = () => screen.getByLabelText("审批凭证") as HTMLInputElement;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function openApproval() {
  await waitFor(() => expect(disabled("批准本版内容")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "批准本版内容" }));
  await screen.findByText("批准第 3 版内容");
  fireEvent.change(secret(), { target: { value: credential } });
}
beforeEach(() => {
  vi.mocked(api.getApprovalPolicy).mockResolvedValue(policy);
  vi.spyOn(message, "success").mockImplementation(() => (() => {}) as ReturnType<typeof message.success>);
  vi.spyOn(message, "warning").mockImplementation(() => (() => {}) as ReturnType<typeof message.warning>);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); });

describe("P08 独立前端验收", () => {
  it("策略未读取、未配置或读取失败时审批默认禁用，内容仍可编辑", async () => {
    const pending = deferred<typeof policy>();
    vi.mocked(api.getApprovalPolicy).mockReturnValueOnce(pending.promise);
    const mounted = render(<RequirementContentPanel item={requirement} onUpdated={vi.fn()} />);
    expect(disabled("批准本版内容")).toBe(true);
    expect(disabled("编辑需求内容")).toBe(false);
    await act(async () => pending.resolve({ ...policy, configured: false }));
    await screen.findByText("审批尚未启用，请配置服务端审批凭证");
    expect(disabled("批准本版内容")).toBe(true);
    mounted.unmount();
    vi.mocked(api.getApprovalPolicy).mockRejectedValueOnce(new Error("offline"));
    render(<RequirementContentPanel item={requirement} onUpdated={vi.fn()} />);
    await screen.findByText("无法读取审批配置，请刷新页面");
    expect(disabled("批准本版内容")).toBe(true);
    expect(api.approveRevision).not.toHaveBeenCalled();
  });

  it("弹窗打开后版本变化只使原目标失效，不替换内容，且立即清理凭证", async () => {
    const onUpdated = vi.fn();
    const mounted = render(<RequirementContentPanel item={requirement} onUpdated={onUpdated} />);
    await openApproval();
    mounted.rerender(<RequirementContentPanel item={{ ...requirement, revision: 9, contentRevision: 4, title: "新的目标 B", scope: "新范围" }} onUpdated={onUpdated} />);
    await waitFor(() => expect(secret().value).toBe(""));
    expect(secret().disabled).toBe(true);
    expect(disabled("确认批准")).toBe(true);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("待审需求 A")).toBeTruthy();
    expect(within(dialog).queryByText("新的目标 B")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "确认批准" }));
    expect(api.approveRevision).not.toHaveBeenCalled();
  });

  it("服务端 409 即使刷新失败也锁住旧审批目标，并清理凭证", async () => {
    vi.mocked(api.approveRevision).mockRejectedValue(Object.assign(new Error("服务端版本冲突"), { status: 409 }));
    const onUpdated = vi.fn().mockRejectedValue(new Error("刷新失败"));
    render(<RequirementContentPanel item={requirement} onUpdated={onUpdated} />);
    await openApproval();
    fireEvent.change(screen.getByLabelText("审批说明"), { target: { value: "确认原范围" } });
    fireEvent.click(screen.getByRole("button", { name: "确认批准" }));
    await screen.findByText("服务端版本冲突");
    await waitFor(() => expect(secret().value).toBe(""));
    expect(disabled("确认批准")).toBe(true);
    expect(api.approveRevision).toHaveBeenCalledTimes(1);
    expect(api.approveRevision).toHaveBeenCalledWith("review-a", { expectedRevision: 8, expectedContentRevision: 3, reason: "确认原范围" }, credential);
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(screen.getByText("批准第 3 版内容")).toBeTruthy();
  });

  it("凭证校验失败后保留内容与说明但清空凭证，关闭后再次打开仍为空", async () => {
    vi.mocked(api.approveRevision).mockRejectedValue(Object.assign(new Error("凭证无效"), { status: 403 }));
    render(<RequirementContentPanel item={requirement} onUpdated={vi.fn()} />);
    await openApproval();
    fireEvent.change(screen.getByLabelText("审批说明"), { target: { value: "保留说明" } });
    fireEvent.click(screen.getByRole("button", { name: "确认批准" }));
    await screen.findByText("凭证无效");
    expect(secret().value).toBe("");
    expect((screen.getByLabelText("审批说明") as HTMLTextAreaElement).value).toBe("保留说明");
    expect(secret().disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));
    fireEvent.click(screen.getByRole("button", { name: "批准本版内容" }));
    expect(secret().value).toBe("");
    expect((screen.getByLabelText("审批说明") as HTMLTextAreaElement).value).toBe("");
  });

  it("撤销使用当前固定版本，成功但刷新失败明确提示操作已记录", async () => {
    vi.mocked(api.revokeApproval).mockResolvedValue(requirement);
    render(<RequirementContentPanel item={{ ...requirement, approvalStatus: "approved", approvedContentRevision: 3 }} onUpdated={vi.fn().mockRejectedValue(new Error("offline"))} />);
    await waitFor(() => expect(disabled("撤销批准")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "撤销批准" }));
    fireEvent.change(secret(), { target: { value: credential } });
    fireEvent.click(screen.getByRole("button", { name: "确认撤销" }));
    await waitFor(() => expect(message.warning).toHaveBeenCalledWith("操作已记录，但页面刷新失败，请重新载入"));
    expect(api.revokeApproval).toHaveBeenCalledTimes(1);
    expect(api.revokeApproval).toHaveBeenCalledWith("review-a", { expectedRevision: 8, expectedContentRevision: 3, reason: "" }, credential);
    expect(screen.queryByLabelText("审批凭证")).toBeNull();
  });

  it("编辑时父页新版本使保存失效，显式重载失败仍保留草稿", async () => {
    const onUpdated = vi.fn().mockRejectedValue(new Error("父页加载失败"));
    const mounted = render(<RequirementContentEditor item={requirement} onClose={vi.fn()} onUpdated={onUpdated} />);
    fireEvent.change(screen.getByLabelText("实施范围"), { target: { value: "我的未保存草稿" } });
    const fresh = { ...requirement, revision: 10, contentRevision: 4, scope: "服务器范围" };
    mounted.rerender(<RequirementContentEditor item={fresh} onClose={vi.fn()} onUpdated={onUpdated} />);
    expect(disabled("保存内容")).toBe(true);
    vi.mocked(api.getRequirement).mockResolvedValueOnce(fresh);
    fireEvent.click(screen.getByRole("button", { name: "放弃草稿，重新载入" }));
    await screen.findByText("父页加载失败");
    expect((screen.getByLabelText("实施范围") as HTMLTextAreaElement).value).toBe("我的未保存草稿");
    expect(screen.getByText("编辑第 3 版需求内容")).toBeTruthy();
    expect(disabled("保存内容")).toBe(true);
    expect(api.patchRequirement).not.toHaveBeenCalled();
  });

  it("成功保存后刷新失败显示已保存，不让用户误认为提交失败", async () => {
    const onClose = vi.fn();
    vi.mocked(api.patchRequirement).mockResolvedValue(requirement);
    render(<RequirementContentEditor item={requirement} onClose={onClose} onUpdated={vi.fn().mockRejectedValue(new Error("offline"))} />);
    fireEvent.change(screen.getByLabelText("验收条件（每行一条）"), { target: { value: "  条件一  \n\n条件二" } });
    fireEvent.click(screen.getByRole("button", { name: "保存内容" }));
    await waitFor(() => expect(message.warning).toHaveBeenCalledWith("内容已保存，但页面刷新失败，请重新载入"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.patchRequirement).toHaveBeenCalledWith("review-a", expect.objectContaining({ expectedRevision: 8, acceptanceCriteria: ["条件一", "条件二"] }));
  });

  it("内容历史失败不掩盖成功读取的审批记录", async () => {
    vi.mocked(api.getRequirementRevisions).mockRejectedValue(new Error("offline"));
    vi.mocked(api.getApprovalHistory).mockResolvedValue({ items: [approvalEvent(8)], nextBefore: null });
    render(<RequirementHistory id="review-a" onClose={vi.fn()} />);
    await screen.findByText("内容历史加载失败，请关闭后重试");
    expect(await screen.findByText("审计理由 8")).toBeTruthy();
    expect(screen.queryByText("暂无内容修订")).toBeNull();
  });

  it("历史翻页失败保留现有比较和审计，重试沿用原游标而不漏页", async () => {
    vi.mocked(api.getRequirementRevisions).mockResolvedValueOnce({ currentContentRevision: 3, total: 3, items: [contentRevision(3), contentRevision(2)], nextBefore: 2 })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ currentContentRevision: 3, total: 3, items: [contentRevision(1)], nextBefore: null });
    vi.mocked(api.getApprovalHistory).mockResolvedValueOnce({ items: [approvalEvent(8)], nextBefore: 8 })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ items: [approvalEvent(7)], nextBefore: null });
    render(<RequirementHistory id="review-a" onClose={vi.fn()} />);
    await screen.findByRole("region", { name: "内容版本对比" });
    fireEvent.click(screen.getByRole("button", { name: "加载更早修订" }));
    await screen.findByText("更早修订加载失败，可以重试");
    expect(within(screen.getByRole("region", { name: "内容版本对比" })).getByText("范围 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "加载更早修订" }));
    await screen.findByText("迁移时快照");
    expect(vi.mocked(api.getRequirementRevisions).mock.calls).toEqual([["review-a"], ["review-a", 2], ["review-a", 2]]);
    fireEvent.click(screen.getByRole("button", { name: "加载更早审批" }));
    await screen.findByText("更早审批加载失败，可以重试");
    expect(screen.getByText("审计理由 8")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "加载更早审批" }));
    await screen.findByText("审计理由 7");
    expect(vi.mocked(api.getApprovalHistory).mock.calls).toEqual([["review-a"], ["review-a", 8], ["review-a", 8]]);
  });

  it("导航后迟到的初始请求不能覆盖新需求或重新展示旧审批入口", async () => {
    const old = deferred<Requirement>();
    vi.mocked(api.getRequirement).mockImplementation((id) => id === "review-a" ? old.promise : Promise.resolve({ ...requirement, id, title: "新路由需求 B" }));
    const router = createMemoryRouter([{ path: "/requirements/:id", element: <RequirementDetail /> }], { initialEntries: ["/requirements/review-a"] });
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(api.getRequirement).toHaveBeenCalledWith("review-a"));
    await act(async () => { await router.navigate("/requirements/review-b"); });
    await screen.findByRole("heading", { name: "新路由需求 B" });
    await act(async () => old.resolve(requirement));
    expect(screen.getByRole("heading", { name: "新路由需求 B" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "待审需求 A" })).toBeNull();
  });

  it("审批完成触发的旧页刷新迟到时不能覆盖新路由需求", async () => {
    const oldRefresh = deferred<Requirement>();
    vi.mocked(api.getRequirement).mockResolvedValueOnce(requirement).mockReturnValueOnce(oldRefresh.promise)
      .mockResolvedValue({ ...requirement, id: "review-b", title: "新路由需求 B" });
    vi.mocked(api.approveRevision).mockResolvedValue({ ...requirement, revision: 9, approvalStatus: "approved", approvedContentRevision: 3 });
    const router = createMemoryRouter([{ path: "/requirements/:id", element: <RequirementDetail /> }], { initialEntries: ["/requirements/review-a"] });
    render(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "待审需求 A" });
    await openApproval();
    fireEvent.click(screen.getByRole("button", { name: "确认批准" }));
    await waitFor(() => expect(api.getRequirement).toHaveBeenCalledTimes(2));
    await act(async () => { await router.navigate("/requirements/review-b"); });
    await screen.findByRole("heading", { name: "新路由需求 B" });
    await act(async () => oldRefresh.resolve({ ...requirement, revision: 9, approvalStatus: "approved", approvedContentRevision: 3 }));
    expect(screen.getByRole("heading", { name: "新路由需求 B" })).toBeTruthy();
    expect(screen.queryByText("本版内容已批准")).toBeNull();
    expect(screen.queryByLabelText("审批凭证")).toBeNull();
  });

  it("同页重叠刷新以最后发起的请求为准，迟到旧结果不能回滚内容修订", async () => {
    const slowRefresh = deferred<Requirement>();
    const fastRefresh = deferred<Requirement>();
    vi.mocked(api.getRequirement).mockResolvedValueOnce({ ...requirement, prUrl: "https://github.com/Era3e/MagicTools/pull/69" })
      .mockReturnValueOnce(slowRefresh.promise).mockReturnValueOnce(fastRefresh.promise);
    vi.mocked(api.refreshPr).mockResolvedValue(requirement);
    const router = createMemoryRouter([{ path: "/requirements/:id", element: <RequirementDetail /> }], { initialEntries: ["/requirements/review-a"] });
    render(<RouterProvider router={router} />);
    fireEvent.click(await screen.findByRole("button", { name: "刷新 PR 状态" }));
    await waitFor(() => expect(api.getRequirement).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "刷新 PR 状态" }));
    await waitFor(() => expect(api.getRequirement).toHaveBeenCalledTimes(3));
    await act(async () => fastRefresh.resolve({ ...requirement, title: "新内容修订", revision: 10, contentRevision: 4 }));
    expect(screen.getByRole("heading", { name: "新内容修订" })).toBeTruthy();
    await act(async () => slowRefresh.resolve({ ...requirement, title: "较旧内容修订", revision: 9 }));
    expect(screen.getByRole("heading", { name: "新内容修订" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "较旧内容修订" })).toBeNull();
  });
});

function contentRevision(version: number): ContentRevision {
  return { contentRevision: version, content: { ...contentFromRequirement(requirement), scope: "范围 " + version }, origin: version === 1 ? "backfill" : "edited",
    createdFromRevision: version + 5, createdAt: requirement.updatedAt, changedFields: version === 1 ? [] : ["scope"] };
}
function approvalEvent(revision: number): ApprovalEvent {
  return { id: "event-" + revision, contentRevision: 3, requirementRevision: revision, decision: "approved", actorId: "owner-review", authMethod: "owner-token", reason: "审计理由 " + revision, createdAt: requirement.updatedAt };
}
