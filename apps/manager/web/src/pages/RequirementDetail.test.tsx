import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import RequirementDetail from "./RequirementDetail";
import { api } from "../api";

vi.mock("../api", () => ({ api: { getRequirement: vi.fn(), patchRequirement: vi.fn(), refreshPr: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("需求详情并发恢复", () => {
  it("更新状态保留未保存的关联草稿，并仅在服务器关联未变时更新草稿版本", async () => {
    const initial = { id: "req-2", revision: 1, title: "保留草稿", description: "", source: "manual",
      status: "waiting" as const, priority: "P2", branch: "old-branch", prUrl: "", timeline: [], labels: [],
      iterationId: null, sourcePayload: null, sourceRef: "", updatedAt: "2026-09-11T00:00:00Z",
      allowedNextStatuses: ["designing" as const, "todo" as const] };
    const latest = { ...initial, revision: 2, status: "designing" as const };
    vi.mocked(api.getRequirement).mockResolvedValueOnce(initial).mockResolvedValue(latest);
    vi.mocked(api.patchRequirement).mockResolvedValue(latest);
    render(<MemoryRouter initialEntries={["/requirements/req-2"]}><Routes>
      <Route path="/requirements/:id" element={<RequirementDetail />} />
    </Routes></MemoryRouter>);
    fireEvent.change(await screen.findByDisplayValue("old-branch"), { target: { value: "unsaved-user-branch" } });
    fireEvent.mouseDown(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByText("设计中"));
    await waitFor(() => expect(api.getRequirement).toHaveBeenCalledTimes(2));
    expect(screen.getByDisplayValue("unsaved-user-branch")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "保存关联" }));
    await waitFor(() => expect(api.patchRequirement).toHaveBeenLastCalledWith("req-2", {
      branch: "unsaved-user-branch", prUrl: "", expectedRevision: 2,
    }));
  });

  it("版本冲突后同步最新关联输入，重试不能覆盖未编辑的远端修改", async () => {
    const initial = { id: "req-1", revision: 1, title: "协作需求", description: "", source: "manual",
      status: "todo" as const, priority: "P2", branch: "old-branch", prUrl: "", timeline: [], labels: [],
      iterationId: null, sourcePayload: null, sourceRef: "", updatedAt: "2026-09-11T00:00:00Z" };
    const latest = { ...initial, revision: 2, branch: "remote-new-branch" };
    vi.mocked(api.getRequirement).mockResolvedValueOnce(initial).mockResolvedValue(latest);
    vi.mocked(api.patchRequirement).mockRejectedValueOnce(new Error("需求已被其他操作更新"))
      .mockResolvedValue(latest);
    render(<MemoryRouter initialEntries={["/requirements/req-1"]}><Routes>
      <Route path="/requirements/:id" element={<RequirementDetail />} />
    </Routes></MemoryRouter>);
    await screen.findByDisplayValue("old-branch");
    fireEvent.click(await screen.findByRole("button", { name: "保存关联" }));
    await screen.findByDisplayValue("remote-new-branch");
    fireEvent.click(await screen.findByRole("button", { name: "保存关联" }));
    await waitFor(() => expect(api.patchRequirement).toHaveBeenLastCalledWith("req-1", {
      branch: "remote-new-branch", prUrl: "", expectedRevision: 2,
    }));
  });
});
