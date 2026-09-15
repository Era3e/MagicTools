import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RepositoryEvidence from "./RepositoryEvidence";

afterEach(() => vi.unstubAllGlobals());

describe("RepositoryEvidence", () => {
  it("提交仓库与SHA后展示反向整理候选和证据链接", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/repository-evidence/reverse-engineer")) {
        expect(init?.method).toBe("POST");
        expect(String(init?.body)).toContain("Era3e/MagicTools");
        return new Response(JSON.stringify({
          created: true,
          task: { id: "task-1", repo: "Era3e/MagicTools", commitSha: "f".repeat(40), commitMessage: "feat", totalFiles: 6, selectedFiles: 5, createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z" },
          candidates: [{ id: "c1", taskId: "task-1", title: "接口行为：src/export.controller.ts", description: "接口行为变更", motivation: "unknown", category: "controller", path: "src/export.controller.ts", contentSha256: "a".repeat(64), evidence: { commit: "f".repeat(40), path: "src/export.controller.ts", startLine: 1, endLine: 4, url: "https://github.com/Era3e/MagicTools/blob/ffff/src/export.controller.ts#L1-L4", excerpt: "export class ExportController" }, createdAt: "2026-09-14T00:00:00Z" }],
        }), { status: 201 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RepositoryEvidence />);

    fireEvent.change(await screen.findByLabelText("GitHub 仓库"), { target: { value: "Era3e/MagicTools" } });
    fireEvent.change(screen.getByLabelText("提交 SHA"), { target: { value: "f".repeat(40) } });
    fireEvent.click(screen.getByRole("button", { name: "反向整理" }));

    expect(await screen.findByText("接口行为：src/export.controller.ts")).toBeTruthy();
    expect(screen.getByText("unknown")).toBeTruthy();
    expect(screen.getByRole("link", { name: /src\/export\.controller\.ts#L1-L4/ })).toHaveProperty("href");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: /反向整理/ }) as HTMLButtonElement).disabled).toBe(false)
    );
  });
});
