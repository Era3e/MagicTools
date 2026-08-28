/**
 * D-06 Obsidian 冲突解决 — 单元测试
 *
 * 覆盖场景：
 *   1. 同步时检测内容变更 → 标记 conflicted
 *   2. 列出待解决冲突
 *   3. keep-db 策略 → 保留数据库版本
 *   4. take-obsidian 策略 → 采用 Obsidian 版本
 *   5. merge 策略 → 使用合并内容
 *   6. 批量解决冲突
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetSetting,
  mockSetSetting,
  mockFindEntryBySourceRef,
  mockCreateEntry,
  mockUpdateEntry,
  mockGetEntry,
  mockEmbed,
  mockPoolQuery,
} = vi.hoisted(() => ({
  mockGetSetting: vi.fn(),
  mockSetSetting: vi.fn(),
  mockFindEntryBySourceRef: vi.fn(),
  mockCreateEntry: vi.fn(),
  mockUpdateEntry: vi.fn(),
  mockGetEntry: vi.fn(),
  mockEmbed: vi.fn(),
  mockPoolQuery: vi.fn(),
}));

vi.mock("./settings.repo", () => ({
  getSetting: mockGetSetting,
  setSetting: mockSetSetting,
}));

vi.mock("./entry.repo", () => ({
  findEntryBySourceRef: mockFindEntryBySourceRef,
  createEntry: mockCreateEntry,
  updateEntry: mockUpdateEntry,
  getEntry: mockGetEntry,
}));

vi.mock("./llm", () => ({
  embed: mockEmbed,
}));

vi.mock("./db", () => ({
  pool: { query: mockPoolQuery },
}));

// Mock fs operations
vi.mock("node:fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({ isDirectory: () => true }),
  readFileSync: vi.fn().mockImplementation((path: string) => {
    // 根据文件路径返回不同内容
    if (path.includes("note1")) return "# 原始标题\n原始内容";
    if (path.includes("note2")) return "# 笔记二\n内容二";
    return "";
  }),
  readdirSync: vi.fn().mockReturnValue([
    { name: "note1.md", isFile: () => true, isDirectory: () => false },
    { name: "note2.md", isFile: () => true, isDirectory: () => false },
    { name: "sub", isFile: () => false, isDirectory: () => true },
  ]),
}));

// Mock recursive readdir behavior
import * as fs from "node:fs";
const originalReaddir = fs.readdirSync as unknown as ReturnType<typeof vi.fn>;
// Setup subdirectory mock
originalReaddir.mockImplementation((dir: string) => {
  if (dir.includes("sub")) {
    return [{ name: "note3.md", isFile: () => true, isDirectory: () => false }];
  }
  return [
    { name: "note1.md", isFile: () => true, isDirectory: () => false },
    { name: "note2.md", isFile: () => true, isDirectory: () => false },
    { name: "sub", isFile: () => false, isDirectory: () => true },
  ];
});

import { ObsidianService } from "./obsidian.service";

const VAULT_PATH = "/fake/vault";

describe("ObsidianService — D-06 冲突解决", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSetting.mockResolvedValue(VAULT_PATH);
    mockEmbed.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mockCreateEntry.mockResolvedValue({ id: "new-1" });
    mockUpdateEntry.mockResolvedValue({ id: "entry-1" });
  });

  // ── 场景 1：新文件同步 → 创建新条目 ─────────────────────────
  it("新文件同步 → 创建新条目并跳过已存在", async () => {
    // note1.md 已存在，note2.md 不存在，sub/note3.md 不存在
    mockFindEntryBySourceRef
      .mockResolvedValueOnce({
        id: "entry-1",
        content: "# 旧标题\n旧内容",
        updatedAt: "2025-01-01T00:00:00Z",
      })
      .mockResolvedValueOnce(null) // note2.md
      .mockResolvedValueOnce(null); // sub/note3.md

    // 模拟数据库查询
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const svc = new ObsidianService();
    const result = await svc.sync();

    // 3 个 md 文件：note1.md(跳过) + note2.md(新建) + sub/note3.md(新建)
    expect(result.scanned).toBe(3);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(1);
  });

  // ── 场景 2：内容变更 → 标记 conflicted ──────────────────────
  it("内容变更 → 标记 conflicted 并返回冲突列表", async () => {
    // note1.md 内容已变更
    mockFindEntryBySourceRef
      .mockResolvedValueOnce({
        id: "entry-1",
        content: "# 旧标题\n旧内容", // 与当前文件内容不同
        updatedAt: "2025-01-01T00:00:00Z",
      })
      .mockResolvedValueOnce(null);

    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const svc = new ObsidianService();
    const result = await svc.sync();

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0].entryId).toBe("entry-1");
    expect(result.conflicts[0].dbContent).toContain("旧内容");
    expect(result.conflicts[0].obsidianContent).toContain("原始内容");

    // 验证 markConflicted 被调用
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE entries SET sync_status = 'conflicted'/),
      expect.any(Array)
    );
  });

  // ── 场景 3：keep-db 策略 → 保留数据库版本 ───────────────────
  it("keep-db 策略 → 保留数据库版本，清除冲突", async () => {
    mockGetEntry.mockResolvedValue({
      id: "entry-1",
      source: "obsidian" as const,
      sourceRef: "note1.md",
      title: "笔记一",
      content: "# 旧标题\n旧内容",
      summary: "",
      category: "obsidian",
      tags: [],
      assistantScope: false,
      createdAt: "",
      updatedAt: "",
    });

    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const svc = new ObsidianService();
    await svc.resolveConflict("entry-1", "keep-db");

    // 验证 sync_status 被设为 synced
    const lastCall = mockPoolQuery.mock.calls[mockPoolQuery.mock.calls.length - 1];
    expect(lastCall[0]).toMatch(/sync_status = 'synced'/);
  });

  // ── 场景 4：take-obsidian 策略 → 采用 Obsidian 版本 ─────────
  it("take-obsidian 策略 → 更新内容为 Obsidian 版本", async () => {
    mockGetEntry.mockResolvedValue({
      id: "entry-1",
      source: "obsidian" as const,
      sourceRef: "note1.md",
      title: "笔记一",
      content: "# 旧标题\n旧内容",
      summary: "",
      category: "obsidian",
      tags: [],
      assistantScope: false,
      createdAt: "",
      updatedAt: "",
    });

    // getPendingContent 查询 + updateEntry + 清除冲突
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ obsidian_pending_content: "# 新标题\n新内容" }],
      rowCount: 1,
    });
    mockUpdateEntry.mockResolvedValue({ id: "entry-1" });

    const svc = new ObsidianService();
    await svc.resolveConflict("entry-1", "take-obsidian");

    // 验证 updateEntry 被调用，内容为 Obsidian 版本
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      "entry-1",
      expect.objectContaining({ content: "# 新标题\n新内容" })
    );
  });

  // ── 场景 5：merge 策略 → 使用合并内容 ───────────────────────
  it("merge 策略 → 使用提供的合并内容", async () => {
    mockGetEntry.mockResolvedValue({
      id: "entry-1",
      source: "obsidian" as const,
      sourceRef: "note1.md",
      title: "笔记一",
      content: "# 旧标题\n旧内容",
      summary: "",
      category: "obsidian",
      tags: [],
      assistantScope: false,
      createdAt: "",
      updatedAt: "",
    });

    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const svc = new ObsidianService();
    const merged = "# 合并标题\n合并后的内容";
    await svc.resolveConflict("entry-1", "merge", merged);

    expect(mockUpdateEntry).toHaveBeenCalledWith(
      "entry-1",
      expect.objectContaining({ content: merged })
    );
  });

  // ── 场景 6：merge 无内容 → 抛异常 ─────────────────────────
  it("merge 策略未提供内容 → 抛 BadRequestException", async () => {
    mockGetEntry.mockResolvedValue({
      id: "entry-1",
      source: "obsidian" as const,
      sourceRef: "note1.md",
      title: "笔记一",
      content: "# 旧标题\n旧内容",
      summary: "",
      category: "obsidian",
      tags: [],
      assistantScope: false,
      createdAt: "",
      updatedAt: "",
    });

    const svc = new ObsidianService();
    await expect(svc.resolveConflict("entry-1", "merge")).rejects.toThrow(/合并内容不能为空/);
  });

  // ── 场景 7：条目不存在 → 抛 NotFoundException ──────────────
  it("解决不存在的条目 → 抛 NotFoundException", async () => {
    mockGetEntry.mockResolvedValue(null);

    const svc = new ObsidianService();
    await expect(svc.resolveConflict("nonexistent", "keep-db")).rejects.toThrow(/条目不存在/);
  });
});
