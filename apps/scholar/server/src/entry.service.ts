import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { embed } from "./llm";
import { entryInputSchema, entryPatchSchema } from "./schemas";
import { createEntry, findEntryBySourceRef, getEntry, listEntries, setCategoryScope, updateEntry } from "./entry.repo";

@Injectable()
export class EntryService {
  list(filters: { source?: string; category?: string; tag?: string; spaceKey?: string }) {
    return listEntries(filters);
  }

  async get(id: string) {
    const row = await getEntry(id);
    if (!row) throw new NotFoundException("条目不存在");
    return row;
  }

  async create(input: unknown) {
    const parsed = entryInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("标题必填");
    if (parsed.data.sourceRef) {
      const existing = await findEntryBySourceRef("manual", parsed.data.sourceRef);
      if (existing) return existing;
    }
    const [vec] = await embed([(parsed.data.title + "\\n" + parsed.data.content).slice(0, 3000)]);
    const row = await createEntry({
      source: "manual",
      sourceRef: parsed.data.sourceRef ?? null,
      title: parsed.data.title,
      content: parsed.data.content,
      summary: parsed.data.summary,
      category: parsed.data.category,
      tags: parsed.data.tags,
      embedding: vec,
      spaceKey: parsed.data.spaceKey,
      sourceRevision: parsed.data.sourceRevision,
      sourceUrl: parsed.data.sourceUrl,
      requirementId: parsed.data.requirementId,
      requirementUrl: parsed.data.requirementUrl,
    });
    if (!row) {
      const concurrent = parsed.data.sourceRef ? await findEntryBySourceRef("manual", parsed.data.sourceRef) : null;
      if (concurrent) return concurrent;
      throw new BadRequestException("条目创建失败");
    }
    return row;
  }

  async patch(id: string, input: unknown) {
    const current = await getEntry(id);
    if (!current) throw new NotFoundException("条目不存在");
    const parsed = entryPatchSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("更新参数非法");
    const patch: Parameters<typeof updateEntry>[1] = { ...parsed.data };
    if (parsed.data.title !== undefined || parsed.data.content !== undefined) {
      const [vec] = await embed([((parsed.data.title ?? current.title) + "\\n" + (parsed.data.content ?? current.content)).slice(0, 3000)]);
      patch.embedding = vec;
      patch.spaceKey = undefined;
    }
    const row = await updateEntry(id, patch);
    if (!row) throw new NotFoundException("条目不存在");
    return row;
  }

  async scopeCategory(category: string, scope: boolean) {
    if (!category) throw new BadRequestException("分类不能为空");
    return { updated: await setCategoryScope(category, scope) };
  }
}
