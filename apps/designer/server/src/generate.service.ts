import { BadRequestException, Injectable } from "@nestjs/common";
import type { ChatOptions, ContentPart } from "@mt/model-client";
import { createGeneration, listGenerations } from "./generation.repo";
import { parseJson } from "./json";
import { llmChat } from "./llm";
import { componentGenSchema, generateInputSchema } from "./schemas";

const GENERATE_PROMPT =
  '你是 React 组件生成器。根据用户描述（可含设计稿图片）生成完整 React 函数组件。要求：1) 可用 antd 组件；2) 颜色一律使用 @mt/ui 的 tokens（import { tokens } from "@mt/ui"），禁止硬编码色值；3) 默认导出函数组件。只输出 JSON：{componentName: PascalCase 组件名, description: 一句话描述, code: 组件完整源码}。{component}';

@Injectable()
export class GenerateService {
  async generate(input: unknown) {
    const parsed = generateInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("prompt 必填");
    const { prompt, imageUrl } = parsed.data;

    const userContent: ContentPart[] = [{ type: "text", text: prompt }];
    if (imageUrl) userContent.push({ type: "image_url", image_url: { url: imageUrl } });
    const options: ChatOptions = imageUrl ? { vision: true } : {};

    try {
      const raw = await llmChat(
        [
          { role: "system", content: GENERATE_PROMPT },
          { role: "user", content: userContent },
        ],
        options
      );
      const gen = componentGenSchema.parse(parseJson(raw));
      const row = await createGeneration({
        prompt,
        imageUrl: imageUrl ?? "",
        componentName: gen.componentName,
        description: gen.description,
        code: gen.code,
        status: "ok",
      });
      return {
        generationId: row.id,
        componentName: row.componentName,
        description: row.description,
        code: row.code,
        status: "ok" as const,
      };
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err).slice(0, 500);
      const row = await createGeneration({
        prompt,
        imageUrl: imageUrl ?? "",
        componentName: "",
        description: "",
        code: "",
        status: "failed",
        error: msg,
      });
      return { generationId: row.id, componentName: "", description: "", code: "", status: "failed" as const, error: msg };
    }
  }

  list() {
    return listGenerations();
  }
}
