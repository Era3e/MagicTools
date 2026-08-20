import { BadGatewayException, Injectable } from "@nestjs/common";
import { parseJson } from "./json";
import { llmChat } from "./llm";
import { answerSchema, queryParamsSchema } from "./schemas";

const PARAMS_PROMPT = "你是数据查询参数生成器。根据用户问题输出 JSON：{endpoint: 接口路径, params: 查询参数对象}。{params}";
const FORMAT_PROMPT = "把数据查询结果格式化为自然语言回答。只输出 JSON：{answer: 文本}。{format}";

@Injectable()
export class CybercloudService {
  status() {
    return {
      configured: Boolean(process.env.CYBERCLOUD_BASE_URL),
      stub: process.env.CYBERCLOUD_STUB === "1",
      baseUrl: process.env.CYBERCLOUD_BASE_URL ?? "",
    };
  }

  async query(message: string): Promise<{ reply: string }> {
    if (process.env.CYBERCLOUD_STUB === "1") {
      return { reply: "桩数据查询结果：本月销售额 12345 元（CYBERCLOUD_STUB 桩模式）" };
    }
    const baseUrl = process.env.CYBERCLOUD_BASE_URL ?? "";
    const apiKey = process.env.CYBERCLOUD_API_KEY ?? "";

    const rawSpec = await llmChat([
      { role: "system", content: PARAMS_PROMPT },
      { role: "user", content: message },
    ]);
    const spec = queryParamsSchema.parse(parseJson(rawSpec));

    const res = await fetch(baseUrl + spec.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify(spec.params),
    });
    if (!res.ok) throw new BadGatewayException("数据源查询失败: " + res.status);
    const data = await res.json();

    const rawAnswer = await llmChat([
      { role: "system", content: FORMAT_PROMPT },
      { role: "user", content: JSON.stringify(data) },
    ]);
    try {
      return { reply: answerSchema.parse(parseJson(rawAnswer)).answer };
    } catch {
      return { reply: JSON.stringify(data) };
    }
  }
}
