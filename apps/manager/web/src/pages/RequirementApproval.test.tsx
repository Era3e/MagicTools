import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import RequirementDetail from "./RequirementDetail";
import { api } from "../api";
import { contentFromRequirement } from "./RequirementContentView";

vi.mock("../api", () => ({ api: {
  getRequirement: vi.fn(), patchRequirement: vi.fn(), refreshPr: vi.fn(),
  getApprovalPolicy: vi.fn(), approveRevision: vi.fn(), revokeApproval: vi.fn(),
  getRequirementRevisions: vi.fn(), getApprovalHistory: vi.fn(),
} }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const exampleRequirement = {
  id: "req-approval", revision: 1, contentRevision: 1, approvedContentRevision: null,
  approvalStatus: "unapproved" as const, approvalReadiness: { ready: true, missing: [] },
  title: "有范围的需求", description: "原始目标", project: "manager", scope: "只调整详情页", risk: "low" as const,
  acceptanceCriteria: ["正确展示信息"], dependencyRefs: [], evidenceRefs: [], automationPolicy: "manual" as const,
  source: "manual", sourceRef: "", sourcePayload: null, status: "designing" as const, priority: "P2",
  branch: "", prUrl: "", iterationId: null, labels: [], timeline: [], updatedAt: "2026-09-11T00:00:00Z",
  allowedNextStatuses: ["todo" as const],
};

describe("需求内容审批", () => {
  it("比较完整内容、标识迁移回填并分页展示修订和审批记录", async () => {
    vi.mocked(api.getRequirement).mockResolvedValue({ ...exampleRequirement, contentRevision: 3 });
    vi.mocked(api.getApprovalPolicy).mockResolvedValue({ configured: false, actorId: "owner", authMethod: "owner-token", automatedExecutionEnabled: false });
    const content = contentFromRequirement(exampleRequirement);
    const revision = { contentRevision: 3, content, origin: "edited" as const, createdFromRevision: 4, createdAt: "2026-09-11T00:00:00Z", changedFields: ["scope"] };
    vi.mocked(api.getRequirementRevisions).mockResolvedValueOnce({ currentContentRevision: 3, total: 3, items: [revision, { ...revision, contentRevision: 2, content: { ...content, scope: "上一范围" } }], nextBefore: 2 })
      .mockResolvedValue({ currentContentRevision: 3, total: 3, items: [{ ...revision, contentRevision: 1, origin: "backfill", changedFields: [], content: { ...content, scope: "迁移时范围" } }], nextBefore: null });
    vi.mocked(api.getApprovalHistory).mockResolvedValueOnce({ items: [{ id: "a2", contentRevision: 2, requirementRevision: 4, decision: "revoked", actorId: "owner", authMethod: "owner-token", reason: "范围需调整", createdAt: revision.createdAt }], nextBefore: 4 })
      .mockResolvedValue({ items: [{ id: "a1", contentRevision: 2, requirementRevision: 3, decision: "approved", actorId: "owner", authMethod: "owner-token", reason: "确认可实施", createdAt: revision.createdAt }], nextBefore: null });
    render(<MemoryRouter initialEntries={["/requirements/req-approval"]}><Routes><Route path="/requirements/:id" element={<RequirementDetail />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "查看版本与审批记录" }));
    const comparison = await screen.findByRole("region", { name: "内容版本对比" });
    expect(within(comparison).getByText("上一范围")).toBeTruthy();
    expect(within(comparison).getByText("只调整详情页")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "加载更早修订" }));
    await screen.findByText("迁移时快照");
    expect(api.getRequirementRevisions).toHaveBeenLastCalledWith("req-approval", 2);
    fireEvent.change(screen.getByLabelText("较早版本"), { target: { value: "1" } });
    await waitFor(() => expect(within(comparison).getByText("迁移时范围")).toBeTruthy());
    await screen.findByText("范围需调整");
    fireEvent.click(screen.getByRole("button", { name: "加载更早审批" }));
    await screen.findByText("确认可实施");
    expect(api.getApprovalHistory).toHaveBeenLastCalledWith("req-approval", 4);
  });

  it("内容编辑冲突保留草稿，显式重载才采用服务器版本", async () => {
    vi.mocked(api.getRequirement).mockResolvedValueOnce(exampleRequirement)
      .mockResolvedValue({ ...exampleRequirement, revision: 3, contentRevision: 2, scope: "他人新范围" });
    vi.mocked(api.getApprovalPolicy).mockResolvedValue({ configured: false, actorId: "owner", authMethod: "owner-token", automatedExecutionEnabled: false });
    vi.mocked(api.patchRequirement).mockRejectedValue(Object.assign(new Error("需求已变化"), { status: 409 }));
    render(<MemoryRouter initialEntries={["/requirements/req-approval"]}><Routes>
      <Route path="/requirements/:id" element={<RequirementDetail />} />
    </Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "编辑需求内容" }));
    fireEvent.change(await screen.findByLabelText("实施范围"), { target: { value: "我的草稿范围" } });
    fireEvent.click(await screen.findByRole("button", { name: "保存内容" }));
    await waitFor(() => expect(api.patchRequirement).toHaveBeenCalledWith("req-approval", expect.objectContaining({ scope: "我的草稿范围", expectedRevision: 1 })));
    await screen.findByText("需求已变化");
    expect((screen.getByLabelText("实施范围") as HTMLTextAreaElement).value).toBe("我的草稿范围");
    expect((await screen.findByRole("button", { name: "保存内容" })) as HTMLButtonElement).toBeTruthy();
    expect((screen.getByRole("button", { name: "保存内容" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "放弃草稿，重新载入" }));
    await waitFor(() => expect((screen.getByLabelText("实施范围") as HTMLTextAreaElement).value).toBe("他人新范围"));
    vi.mocked(api.patchRequirement).mockResolvedValue({ ...exampleRequirement, revision: 4, contentRevision: 3 });
    fireEvent.click(await screen.findByRole("button", { name: "保存内容" }));
    await waitFor(() => expect(api.patchRequirement).toHaveBeenLastCalledWith("req-approval", expect.objectContaining({ expectedRevision: 3 })));
  });

  it("展示待批准内容并提交固定的页面版本和内容修订", async () => {
    vi.mocked(api.getRequirement).mockResolvedValueOnce(exampleRequirement)
      .mockResolvedValue({ ...exampleRequirement, revision: 2, approvedContentRevision: 1, approvalStatus: "approved" });
    vi.mocked(api.getApprovalPolicy).mockResolvedValue({ configured: true, actorId: "owner", authMethod: "owner-token", automatedExecutionEnabled: false });
    vi.mocked(api.approveRevision).mockResolvedValue({ ...exampleRequirement, revision: 2, approvedContentRevision: 1, approvalStatus: "approved" });
    render(<MemoryRouter initialEntries={["/requirements/req-approval"]}><Routes>
      <Route path="/requirements/:id" element={<RequirementDetail />} />
    </Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "批准本版内容" }));
    expect(await screen.findByText("批准第 1 版内容")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("审批凭证"), { target: { value: "test-only-credential-not-for-production" } });
    fireEvent.click(screen.getByRole("button", { name: "确认批准" }));
    await waitFor(() => expect(api.approveRevision).toHaveBeenCalledWith("req-approval", {
      expectedRevision: 1, expectedContentRevision: 1, reason: "",
    }, "test-only-credential-not-for-production"));
    await screen.findByText("本版内容已批准");
    expect(screen.queryByLabelText("审批凭证")).toBeNull();
  });
});
