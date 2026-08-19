import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { parseFeed } from "./feed/parser";
import { createSource, getSource, listSources, updateSource } from "./source.repo";

const TYPES = ["rss", "json_api", "web"];

@Injectable()
export class SourceService {
  list() {
    return listSources();
  }

  async get(id: string) {
    const row = await getSource(id);
    if (!row) throw new NotFoundException("信息源不存在");
    return row;
  }

  create(input: { name: string; type?: string; url?: string; cron?: string; options?: Record<string, unknown> }) {
    if (!input.name?.trim()) throw new BadRequestException("名称必填");
    if (input.type && !TYPES.includes(input.type)) throw new BadRequestException("非法类型: " + input.type);
    return createSource(input);
  }

  async update(id: string, patch: Parameters<typeof updateSource>[1]) {
    if (patch.type && !TYPES.includes(patch.type)) throw new BadRequestException("非法类型: " + patch.type);
    const row = await updateSource(id, patch);
    if (!row) throw new NotFoundException("信息源不存在");
    return row;
  }

  async test(id: string) {
    const row = await getSource(id);
    if (!row) throw new NotFoundException("信息源不存在");
    const items = await parseFeed(row as never);
    return { items };
  }
}
