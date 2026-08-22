import { BadRequestException, Injectable } from "@nestjs/common";
import { listEntries } from "./entry.repo";
import {
  clearGraph,
  findEntityIdByName,
  getGraph,
  insertRelation,
  linkEntryEntity,
  upsertEntity,
} from "./graph.repo";
import { llmChat } from "./llm";
import { graphSchema } from "./schemas";
import { parseJson } from "@mt/model-client";

const ENTRIES_LIMIT = 100;

@Injectable()
export class GraphService {
  get() {
    return getGraph();
  }

  async generate() {
    const entries = await listEntries({});
    if (entries.length === 0) throw new BadRequestException("暂无条目可抽取");
    const lines = entries.slice(0, ENTRIES_LIMIT).map((e) => e.title + "：" + e.content.slice(0, 200));
    const raw = await llmChat([
      {
        role: "system",
        content: "你是知识图谱抽取助手。从条目集中抽取实体与关系，只输出 JSON：{entities: [{name: 实体名, type: 类型}], relations: [{from: 主语实体名, to: 宾语实体名, label: 关系}]}。{graph}",
      },
      { role: "user", content: lines.join("\n") },
    ]);
    const parsed = graphSchema.parse(parseJson(raw));
    await clearGraph();
    for (const ent of parsed.entities) {
      const entityId = await upsertEntity(ent.name, ent.type);
      for (const e of entries) {
        if (e.title.includes(ent.name) || e.content.includes(ent.name)) {
          await linkEntryEntity(e.id, entityId);
        }
      }
    }
    for (const rel of parsed.relations) {
      const fromId = await findEntityIdByName(rel.from);
      const toId = await findEntityIdByName(rel.to);
      if (!fromId || !toId) continue;
      await insertRelation(fromId, toId, rel.label);
    }
    return { entities: parsed.entities.length, relations: parsed.relations.length };
  }
}
