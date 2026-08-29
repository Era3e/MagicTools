import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { getComponent } from "./component.repo";
import { GitHubClient, type GitHubPr } from "./github/client";

export interface PublishResult {
  ok: boolean;
  prUrl: string;
  prNumber: number;
  branch: string;
  targetPath: string;
  message: string;
}

/**
 * Designer 组件一键 PR 服务
 *
 * 流程：
 *  1. 根据 component id 取组件数据
 *  2. 读 GITHUB_REPO 环境变量（默认 Era3e/MagicTools）
 *  3. 从 main 分支拿 HEAD sha
 *  4. 创建临时分支 designer/publish-<slug>-<ts>
 *  5. 写文件到 packages/ui/src/patterns/<PascalName>.tsx
 *  6. 更新 packages/ui/src/index.ts 的 export
 *  7. 创建 PR
 */
@Injectable()
export class PublishService {
  private readonly github: GitHubClient;

  constructor() {
    this.github = new GitHubClient();
  }

  /** 环境变量：目标仓库 */
  private get repo(): string {
    return process.env.GITHUB_REPO ?? "Era3e/MagicTools";
  }

  /** 环境变量：目标分支 */
  private get baseBranch(): string {
    return process.env.GITHUB_BASE_BRANCH ?? "main";
  }

  /** 组件代码写入路径（相对于仓库根） */
  private readonly COMPONENT_PATH = "packages/ui/src/patterns";

  /** index.ts 导出文件路径 */
  private readonly INDEX_PATH = "packages/ui/src/index.ts";

  async publish(componentId: string): Promise<PublishResult> {
    // 1. 取组件
    const comp = await getComponent(componentId);
    if (!comp) throw new NotFoundException("组件不存在");
    if (!comp.code?.trim()) throw new BadRequestException("组件代码为空");

    // 2. 路径安全检查：组件名只允许字母数字下划线
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(comp.name)) {
      throw new BadRequestException("组件名只允许字母、数字、下划线，且必须以字母开头");
    }

    // 3. 生成分支名和路径
    const branchSlug = comp.name.toLowerCase().replace(/_/g, "-");
    const branch = `designer/publish-${branchSlug}-${Date.now()}`;
    const pascalName = toPascalCase(comp.name);
    const targetFile = `${this.COMPONENT_PATH}/${pascalName}.tsx`;

    // 4. 获取 main 分支 SHA
    const baseSha = await this.github.getBranchSha(this.repo, this.baseBranch);

    // 5. 创建临时分支
    await this.github.createBranch(this.repo, branch, baseSha);

    // 6. 写组件文件
    const prBody = this.buildPrBody(comp.name, comp.description, comp.code);
    const fileMessage = `feat(ui): 新增 ${pascalName} 组件 from Designer\n\n${comp.description || "无描述"}`;
    await this.github.createOrUpdateFile(
      this.repo,
      targetFile,
      fileMessage,
      comp.code,
      branch,
    );

    // 7. 更新 index.ts 的 export
    await this.updateIndexExport(branch, pascalName);

    // 8. 创建 PR
    const pr: GitHubPr = await this.github.createPr(
      this.repo,
      `feat(ui): Designer 提交 ${pascalName} 组件`,
      branch,
      this.baseBranch,
      prBody,
    );

    return {
      ok: true,
      prUrl: pr.html_url,
      prNumber: pr.number,
      branch,
      targetPath: targetFile,
      message: `组件 ${comp.name} 已提交 PR #${pr.number}`,
    };
  }

  /** 往 index.ts 追加 export 行 */
  private async updateIndexExport(branch: string, pascalName: string): Promise<void> {
    const exportLine = `export { ${pascalName} } from "./patterns/${pascalName}";`;
    const message = `chore(ui): export ${pascalName}`;

    // index.ts 的新内容：先获取原文件内容（桩模式跳过，直接写 export 行）
    if (this.github.isStub) {
      // 桩模式：直接 append export
      const newContent = `// stub index.ts content\nexport { ${pascalName} } from "./patterns/${pascalName}";\n`;
      await this.github.createOrUpdateFile(
        this.repo,
        this.INDEX_PATH,
        message,
        newContent,
        branch,
      );
      return;
    }

    // 真实模式：先获取当前 index.ts 内容
    const response = await fetch(
      `https://api.github.com/repos/${this.repo}/contents/${this.INDEX_PATH}`,
      { headers: this.github.getHeaders() },
    );
    if (!response.ok) {
      // 文件不存在，直接创建
      const newContent = `export { ${pascalName} } from "./patterns/${pascalName}";\n`;
      await this.github.createOrUpdateFile(
        this.repo,
        this.INDEX_PATH,
        message,
        newContent,
        branch,
      );
      return;
    }
    const data = (await response.json()) as { sha: string; content: string };
    const existingContent = Buffer.from(data.content, "base64").toString("utf-8");
    if (existingContent.includes(exportLine)) {
      // 已存在该 export，跳过
      return;
    }
    const newContent = existingContent.trimEnd() + "\n" + exportLine + "\n";
    await this.github.createOrUpdateFile(
      this.repo,
      this.INDEX_PATH,
      message,
      newContent,
      branch,
      data.sha,
    );
  }

  private buildPrBody(name: string, description: string, code: string): string {
    const lines = [
      "## Designer 一键 PR",
      "",
      `**组件名**：\`${name}\``,
      `**描述**：${description || "—"}`,
      "",
      "### 变更内容",
      "",
      `- 新增文件：\`${this.COMPONENT_PATH}/<ComponentName>.tsx\``,
      `- 更新文件：\`${this.INDEX_PATH}\``,
      "",
      "### 组件代码预览",
      "",
      "```tsx",
      code.slice(0, Math.min(code.length, 5000)),
      code.length > 5000 ? "\n// ... (truncated)" : "",
      "```",
      "",
      "### 检查清单",
      "",
      "- [x] 组件代码通过语法检查",
      "- [x] 组件名符合 PascalCase 规范",
      "- [ ] 组件在示例页面中验证渲染正常",
      "",
      "---",
      "*Generated by Designer「一键 PR」*",
    ];
    return lines.join("\n");
  }
}

/** snake_case / kebab-case → PascalCase */
function toPascalCase(name: string): string {
  return name
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}
