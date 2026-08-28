import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createEntry, findEntryBySourceRef, getEntry, updateEntry } from "./entry.repo";
import { embed } from "./llm";
import { settingsInputSchema } from "./schemas";
import { getSetting, setSetting } from "./settings.repo";

const VAULT_KEY = "vault_path";
const SKIP_DIRS = new Set([".obsidian", ".trash", ".git", "templates", "attachments", "assets"]);

/** 简单内容哈希：用于检测 Obsidian 文件是否变更 */
function contentHash(content: string): string {
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) - h + content.charCodeAt(i)) | 0;
  }
  return "h" + Math.abs(h).toString(36);
}

function walkMd(root: string): Array<{ absolute: string; relative: string }> {
  const out: Array<{ absolute: string; relative: string }> = [];
  function walk(dir: string, relDir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = relDir ? relDir + "/" + entry.name : entry.name;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
        walk(abs, rel);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        out.push({ absolute: abs, relative: rel });
      }
    }
  }
  walk(root, "");
  return out;
}

export interface ConflictInfo {
  entryId: string;
  sourceRef: string;
  title: string;
  dbContent: string;
  obsidianContent: string;
  dbUpdatedAt: string;
}

@Injectable()
export class ObsidianService {
  async getSettings() {
    return { vaultPath: (await getSetting(VAULT_KEY)) ?? "" };
  }

  async updateSettings(input: unknown) {
    const parsed = settingsInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("参数非法");
    await setSetting(VAULT_KEY, parsed.data.vaultPath);
    return { vaultPath: parsed.data.vaultPath };
  }

  /**
   * 同步 Obsidian vault 文件
   *
   * D-06：新增冲突检测
   * - 文件不存在（source_ref 匹配，content_hash 变化）→ 标记 conflicted，返回冲突列表
   * - 文件未导入 → 创建新条目
   */
  async sync(): Promise<{
    scanned: number;
    created: number;
    skipped: number;
    conflicts: ConflictInfo[];
  }> {
    const vaultPath = await getSetting(VAULT_KEY);
    if (!vaultPath) throw new BadRequestException("vault 路径未配置");
    if (!existsSync(vaultPath) || !statSync(vaultPath).isDirectory()) {
      throw new BadRequestException("vault 目录不存在: " + vaultPath);
    }
    const files = walkMd(vaultPath);
    let created = 0;
    let skipped = 0;
    const conflicts: ConflictInfo[] = [];

    for (const f of files) {
      const existing = await findEntryBySourceRef("obsidian", f.relative);
      const content = readFileSync(f.absolute, "utf8").slice(0, 10000);
      const hash = contentHash(content);
      const title = basename(f.relative, ".md");

      if (existing) {
        // 已存在 → 检测冲突
        if (existing.content !== content) {
          // 内容变更：标记 conflicted 状态
          await updateEntry(existing.id, {
            summary: existing.summary, // 保留原 summary
          });
          // 直接用 SQL 更新 sync_status 和 pending 内容
          conflicts.push({
            entryId: existing.id,
            sourceRef: f.relative,
            title,
            dbContent: existing.content,
            obsidianContent: content,
            dbUpdatedAt: existing.updatedAt,
          });
          // 保存待解决的 Obsidian 内容
          await this.markConflicted(existing.id, content);
        }
        skipped += 1;
        continue;
      }

      const [vec] = await embed([(title + "\n" + content).slice(0, 3000)]);
      const createdEntry = await createEntry({
        source: "obsidian",
        sourceRef: f.relative,
        title,
        content,
        summary: "",
        category: "obsidian",
        tags: ["obsidian"],
        embedding: vec,
      });
      if (createdEntry) {
        // 写入 content_hash
        await this.setContentHash(createdEntry.id, hash);
      }
      created += 1;
    }

    return { scanned: files.length, created, skipped, conflicts };
  }

  /**
   * 列出所有待解决的冲突
   */
  async listConflicts(): Promise<ConflictInfo[]> {
    const { pool } = await import("./db");
    const rows = await pool.query(
      "SELECT id, source_ref, title, content, obsidian_pending_content, updated_at FROM entries WHERE source = 'obsidian' AND sync_status = 'conflicted'"
    );
    return rows.rows.map((r) => ({
      entryId: r.id as string,
      sourceRef: r.source_ref as string,
      title: r.title as string,
      dbContent: r.content as string,
      obsidianContent: (r.obsidian_pending_content as string) ?? "",
      dbUpdatedAt: new Date(r.updated_at as string).toISOString(),
    }));
  }

  /**
   * 解决冲突
   * @param entryId 条目 ID
   * @param strategy "keep-db" | "take-obsidian" | "merge"
   * @param mergedContent 当 strategy = "merge" 时提供合并内容
   */
  async resolveConflict(
    entryId: string,
    strategy: "keep-db" | "take-obsidian" | "merge",
    mergedContent?: string
  ): Promise<void> {
    const entry = await getEntry(entryId);
    if (!entry) throw new NotFoundException("条目不存在");

    const { pool } = await import("./db");

    if (strategy === "keep-db") {
      // 保留数据库版本，仅清除冲突状态
      await pool.query(
        "UPDATE entries SET sync_status = 'synced', obsidian_pending_content = NULL WHERE id = $1",
        [entryId]
      );
    } else if (strategy === "take-obsidian") {
      // 采用 Obsidian 版本
      const pending = await this.getPendingContent(entryId);
      await updateEntry(entryId, { content: pending });
      await pool.query(
        "UPDATE entries SET sync_status = 'synced', obsidian_pending_content = NULL WHERE id = $1",
        [entryId]
      );
    } else if (strategy === "merge") {
      if (!mergedContent) throw new BadRequestException("合并内容不能为空");
      await updateEntry(entryId, { content: mergedContent });
      await pool.query(
        "UPDATE entries SET sync_status = 'synced', obsidian_pending_content = NULL WHERE id = $1",
        [entryId]
      );
    }
  }

  /**
   * 批量解决冲突
   */
  async batchResolve(
    resolutions: Array<{
      entryId: string;
      strategy: "keep-db" | "take-obsidian" | "merge";
      mergedContent?: string;
    }>
  ): Promise<{ resolved: number }> {
    let resolved = 0;
    for (const r of resolutions) {
      await this.resolveConflict(r.entryId, r.strategy, r.mergedContent);
      resolved++;
    }
    return { resolved };
  }

  private async markConflicted(entryId: string, obsidianContent: string): Promise<void> {
    const { pool } = await import("./db");
    await pool.query(
      "UPDATE entries SET sync_status = 'conflicted', obsidian_pending_content = $2 WHERE id = $1",
      [entryId, obsidianContent]
    );
  }

  private async setContentHash(entryId: string, hash: string): Promise<void> {
    const { pool } = await import("./db");
    await pool.query(
      "UPDATE entries SET content_hash = $2 WHERE id = $1",
      [entryId, hash]
    );
  }

  private async getPendingContent(entryId: string): Promise<string> {
    const { pool } = await import("./db");
    const rows = await pool.query(
      "SELECT obsidian_pending_content FROM entries WHERE id = $1",
      [entryId]
    );
    return (rows.rows[0]?.obsidian_pending_content as string) ?? "";
  }
}
