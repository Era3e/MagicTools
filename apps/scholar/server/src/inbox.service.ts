import { Injectable } from "@nestjs/common";
import { processOutbox } from "@mt/db";
import { gathererPool } from "./db";
import { createEntry, findEntryBySourceRef } from "./entry.repo";
import { embed } from "./llm";

interface GathererItemPayload {
  itemId?: string;
  url?: string;
  title?: string;
  content?: string;
  summary?: string;
  category?: string;
  keywords?: string[];
}

@Injectable()
export class InboxService {
  async poll() {
    const consumed = await processOutbox(gathererPool(), async () => {});
    const events = await gathererPool().query(
      "SELECT * FROM outbox WHERE event = 'knowledge.item.collected' AND status = 'done' ORDER BY occurred_at ASC"
    );
    let created = 0;
    let skipped = 0;
    for (const row of events.rows) {
      const payload = row.payload as GathererItemPayload;
      const itemId = payload.itemId ?? row.id;
      if (await findEntryBySourceRef("gatherer", itemId)) {
        skipped += 1;
        continue;
      }
      const title = payload.title ?? "未命名条目";
      const content = payload.content ?? "";
      const [vec] = await embed([(title + "\\n" + content).slice(0, 3000)]);
      await createEntry({
        source: "gatherer",
        sourceRef: itemId,
        title,
        content,
        summary: payload.summary ?? "",
        category: payload.category ?? "",
        tags: payload.keywords ?? [],
        embedding: vec,
      });
      created += 1;
    }
    return { consumed, created, skipped };
  }
}