import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { llmChat } from "./llm";
import { parseJdSchema, parsePositionImageSchema } from "./schemas";
import { POSITION_STATUSES, createPosition, getPosition, listPositions, updatePosition, type PositionInput } from "./position.repo";

const JD_PROMPT =
  "你是岗位信息提取助手。从以下 JD 文本提取结构化字段，只输出 JSON，字段：company（公司名）、title（职位名）、city、salary、requirements（要求数组）、duties（职责数组）、keywords（技能关键词数组）。JD 文本：";

export async function parseJd(text: string) {
  const raw = await llmChat([
    { role: "system", content: "只输出 JSON，不要任何解释。" },
    { role: "user", content: JD_PROMPT + text },
  ]);
  return parseJdSchema.parse(JSON.parse(raw));
}

export async function parsePositionImage(dataUrl: string) {
  const raw = await llmChat(
    [
      { role: "system", content: "你是岗位信息提取助手，从截图提取结构化字段，只输出 JSON（字段同 JD 解析：company/title/city/salary/requirements/duties/keywords）。" },
      {
        role: "user",
        content: [
          { type: "text", text: "提取这张截图中的岗位信息" },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    { vision: true }
  );
  return parsePositionImageSchema.parse(JSON.parse(raw));
}

export async function generateGreeting(positionId: string) {
  const position = await getPosition(positionId);
  if (!position) throw new NotFoundException("岗位不存在");
  const raw = await llmChat([
    { role: "system", content: "你是求职助手，为以下岗位写一段 60 字内的打招呼话术（用于招聘平台开场），突出匹配点，只输出话术本身。" },
    { role: "user", content: JSON.stringify({ company: position.company, title: position.title, jdRaw: position.jdRaw.slice(0, 1500) }) },
  ]);
  return { greeting: raw };
}

@Injectable()
export class PositionService {
  async list(status?: string) {
    return listPositions(status);
  }

  async get(id: string) {
    const row = await getPosition(id);
    if (!row) throw new NotFoundException("岗位不存在");
    return row;
  }

  async create(input: PositionInput) {
    if (input.status && !(POSITION_STATUSES as readonly string[]).includes(input.status)) {
      throw new BadRequestException("非法状态: " + input.status);
    }
    return createPosition(input);
  }

  async update(id: string, patch: Partial<PositionInput>) {
    if (patch.status && !(POSITION_STATUSES as readonly string[]).includes(patch.status)) {
      throw new BadRequestException("非法状态: " + patch.status);
    }
    const row = await updatePosition(id, patch);
    if (!row) throw new NotFoundException("岗位不存在");
    return row;
  }
}
