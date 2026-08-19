import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { processOutbox } from "@mt/db";
import { assessorPool } from "./db";
import {
  REQUIREMENT_STATUSES,
  createRequirement,
  findRequirementByEventId,
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
    return row;
  }

  create(input: { title: string; description?: string; priority?: string }) {
    if (!input.title?.trim()) throw new BadRequestException("标题必填");
    return createRequirement({ title: input.title, description: input.description, priority: input.priority, source: "manual" });
  }

  async patch(id: string, patch: Partial<{ title: string; description: string; status: string; priority: string; branch: string; prUrl: string; iterationId: string | null }>) {
    const current = await getRequirement(id);
    if (!current) throw new NotFoundException("需求不存在");
    if (patch.status !== undefined) {
      if (!(REQUIREMENT_STATUSES as readonly string[]).includes(patch.status)) {
        throw new BadRequestException("非法状态: " + patch.status);
      }
      return setStatusWithTimeline(id, patch.status as RequirementStatus, current.status);
    }
    return updateRequirement(id, patch as never);
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
}
