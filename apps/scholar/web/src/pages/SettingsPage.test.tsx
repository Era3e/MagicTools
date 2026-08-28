import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SettingsPage from "./SettingsPage";

describe("SettingsPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/scholar/settings") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ vaultPath: "D:/vault2" }), { status: 200 });
      }
      if (String(url).includes("/api/scholar/settings")) {
        return new Response(JSON.stringify({ vaultPath: "D:/vault" }), { status: 200 });
      }
      if (String(url).includes("/api/scholar/sync/obsidian")) {
        return new Response(JSON.stringify({ scanned: 2, created: 2, skipped: 0, conflicts: [] }), { status: 201 });
      }
      if (String(url).includes("/api/scholar/meta/embedding-status")) {
        return new Response(
          JSON.stringify({ stub: true, provider: "zhipu", model: "embedding-2", apiKeyConfigured: false }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("回显 vault 路径并同步", async () => {
    render(<SettingsPage />);
    expect(await screen.findByDisplayValue("D:/vault")).toBeTruthy();
    fireEvent.click(screen.getByText("同步 Obsidian"));
    expect(await screen.findByText(/导入 2 条/)).toBeTruthy();
  });

  it("显示 embedding 状态", async () => {
    render(<SettingsPage />);
    expect(await screen.findByText(/embedding-2/)).toBeTruthy();
    expect(screen.getAllByText(/桩模式/).length).toBeGreaterThan(0);
  });
});
