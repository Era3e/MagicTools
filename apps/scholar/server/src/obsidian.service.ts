import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { BadRequestException, Injectable } from "@nestjs/common";
import { createEntry, findEntryBySourceRef } from "./entry.repo";
import { embed } from "./llm";
import { settingsInputSchema } from "./schemas";
import { getSetting, setSetting } from "./settings.repo";

const VAULT_KEY = "vault_path";
const SKIP_DIRS = new Set([".obsidian", ".trash", ".git", "templates", "attachments", "assets"]);

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

  async sync() {
    const vaultPath = await getSetting(VAULT_KEY);
    if (!vaultPath) throw new BadRequestException("vault 路径未配置");
    if (!existsSync(vaultPath) || !statSync(vaultPath).isDirectory()) {
      throw new BadRequestException("vault 目录不存在: " + vaultPath);
    }
    const files = walkMd(vaultPath);
    let created = 0;
    let skipped = 0;
    for (const f of files) {
      if (await findEntryBySourceRef("obsidian", f.relative)) {
        skipped += 1;
        continue;
      }
      const content = readFileSync(f.absolute, "utf8").slice(0, 10000);
      const title = basename(f.relative, ".md");
      const [vec] = await embed([(title + "\\n" + content).slice(0, 3000)]);
      await createEntry({
        source: "obsidian",
        sourceRef: f.relative,
        title,
        content,
        summary: "",
        category: "obsidian",
        tags: ["obsidian"],
        embedding: vec,
      });
      created += 1;
    }
    return { scanned: files.length, created, skipped };
  }
}
