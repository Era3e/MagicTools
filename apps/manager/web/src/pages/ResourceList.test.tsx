import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ResourceList from "./ResourceList";
import { api } from "../api";

vi.mock("../api", () => ({ api: { listResources: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("资源面板", () => {
  it("展示归属、预算、备份、密钥引用和分开计数的阻塞/等待检查", async () => {
    vi.mocked(api.listResources).mockResolvedValue({
      summary: {
        total: 3,
        monthlyBudgetCents: 128000,
        statusCounts: { operational: 1, failed: 0, blocked: 1, waiting: 1, unknown: 0 },
        checkCounts: { passed: 2, failed: 0, blocked: 1, waiting: 2 },
        secretRefCount: 1,
      },
      items: [{
        id: "r1",
        name: "production-postgres",
        kind: "database",
        environment: "production",
        owner: "platform-ops",
        provider: "self-hosted",
        region: "aliyun-shanghai",
        budgetCurrency: "CNY",
        monthlyBudgetCents: 128000,
        backupReference: "backup-store://magictools/current",
        runbookUrl: "https://github.com/Era3e/MagicTools/blob/main/docs/features/backup-recovery.md",
        notes: "",
        revision: 1,
        status: "blocked",
        checkCounts: { passed: 2, failed: 0, blocked: 1, waiting: 2 },
        secretRefs: [{
          id: "s1", name: "BACKUP_KEY", source: "file", reference: "file:/etc/magictools/backup/private.key", required: true,
        }],
        latestChecks: [],
        createdAt: "2026-09-16T00:00:00Z",
        updatedAt: "2026-09-16T00:01:00Z",
      }],
    });

    render(<ResourceList />);
    expect(await screen.findByText("production-postgres")).toBeTruthy();
    expect(screen.getByText("platform-ops")).toBeTruthy();
    expect(screen.getByText("1280.00 CNY")).toBeTruthy();
    expect(screen.getByText("backup-store://magictools/current")).toBeTruthy();
    expect(screen.getByText("BACKUP_KEY:file:/etc/magictools/backup/private.key")).toBeTruthy();
    expect(screen.getByText("阻塞")).toBeTruthy();
    expect(screen.getByText(/阻塞 1 · 等待 2/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "打开手册" }).getAttribute("href")).toBe(
      "https://github.com/Era3e/MagicTools/blob/main/docs/features/backup-recovery.md"
    );
    await waitFor(() => expect(api.listResources).toHaveBeenCalled());
  });
});
