import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { processOutbox } from "@mt/db";
import { GitHubClient } from "./github/client";
import { assessorPool } from "./db";
import { requirementInputSchema, requirementPatchSchema } from "./schemas";
import { MANUAL_TRANSITIONS } from "./requirement-policy";
import {
  createRequirement,
  findRequirementByEventId,
  findRequirementByRef,
  getRequirement,
  listRequirements,
  setStatusWithTimeline,
  updateRequirement,
  type RequirementStatus,
} from "./requirement.repo";

@Injectable()
export class RequirementService {
  list(filters: { status?: string; source?: string; iterationId?: string }) {
    return listRequirements(filters);
  }

  async get(id: string) {
    const row = await getRequirement(id);
    if (!row) throw new NotFoundException("需求不存在");
    return { ...row, allowedNextStatuses: MANUAL_TRANSITIONS[row.status] };
  }

  create(input: { title: string; description?: string; priority?: string }) {
    const parsed = requirementInputSchema.pick({ title: true, description: true, priority: true }).safeParse(input);
    if (!parsed.success) throw new BadRequestException("需求参数非法：标题必填，优先级为 P0/P1/P2");
    return createRequirement({ ...parsed.data, source: "manual" });
  }

  async patch(id: string, input: unknown) {
    const parsed = requirementPatchSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("需求更新参数非法");
    const { expectedRevision, ...patch } = parsed.data;
    if (!Object.keys(patch).length) throw new BadRequestException("更新内容不能为空");
    const row = await updateRequirement(id, patch, { expectedRevision });
    if (!row) throw new NotFoundException("需求不存在");
    return { ...row, allowedNextStatuses: MANUAL_TRANSITIONS[row.status] };
  }

  async pollInbox() {
    let consumed = 0;
    await processOutbox(assessorPool, async (event) => {
      if (event.event === "requirement.created") consumed += 1;
    });
    const events = await assessorPool.query(
      "SELECT * FROM outbox WHERE event = 'requirement.created' AND status = 'done' ORDER BY occurred_at ASC"
    );
    let created = 0;
    let skipped = 0;
    for (const row of events.rows) {
      const payload = row.payload as { requestId?: string; surveyName?: string; analysisMd?: string; designMd?: string; repoUrl?: string; reviewComment?: string };
      if (await findRequirementByEventId(row.id as string)) {
        skipped += 1;
        continue;
      }
      await createRequirement({
        title: (payload.surveyName ?? "来自 Assessor 的需求") + " · 需求",
        description: (payload.analysisMd ?? "").slice(0, 2000),
        source: "assessor",
        sourceRef: row.id as string,
        sourcePayload: payload,
        labels: ["assessor"],
      });
      created += 1;
    }
    return { consumed, created, skipped };
  }

  async refreshPr(id: string) {
    const current = await getRequirement(id);
    if (!current) throw new NotFoundException("需求不存在");
    if (!current.prUrl) throw new BadRequestException("未关联 PR");
    const match = current.prUrl.match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/pull\/(\d+)/);
    if (!match) throw new BadRequestException("PR 链接格式不正确");
    const pr = await new GitHubClient().getPr(match[1], Number(match[2]));
    const map: Record<string, RequirementStatus> = { open: "developing", merged: "accepting", closed: "todo" };
    const targetStatus: RequirementStatus = pr.merged ? "accepting" : map[pr.state] ?? current.status;
    // 不可回退 accepting/done
    if (["accepting", "done"].includes(current.status) && targetStatus !== current.status) {
      return current;
    }
    if (targetStatus === current.status) return current;
    return setStatusWithTimeline(id, targetStatus, current.status, "PR 状态联动（" + pr.state + (pr.merged ? "/merged" : "") + "）");
  }

  async syncGithub(repo: string) {
    const issues = await new GitHubClient().listIssues(repo);
    let created = 0;
    let skipped = 0;
    for (const issue of issues) {
      const ref = repo + "#" + issue.number;
      if (await findRequirementByRef("github", ref)) {
        skipped += 1;
        continue;
      }
      await createRequirement({
        title: issue.title,
        description: issue.body.slice(0, 2000),
        source: "github",
        sourceRef: ref,
        labels: issue.labels,
      });
      created += 1;
    }
    return { created, skipped };
  }
}
