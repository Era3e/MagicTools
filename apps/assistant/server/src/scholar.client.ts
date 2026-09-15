import { Injectable } from "@nestjs/common";
import { z } from "zod";

const GATEWAY_URL = () => process.env.INTERNAL_GATEWAY_URL ?? (process.env.MT_PROD === "1" ? "http://gateway:3000" : "http://127.0.0.1:3000");

const candidateSchema = z.object({
  entryId: z.string().uuid(),
  source: z.string(),
  title: z.string(),
  category: z.string(),
  revisionId: z.string().uuid(),
  revisionNo: z.number().int().positive(),
  sourceRevision: z.string(),
  sourceUrl: z.string(),
  productVersionId: z.string().uuid(),
  productVersion: z.string(),
  deploymentRef: z.string(),
  chunkId: z.string().uuid(),
  chunkNo: z.number().int().positive(),
  content: z.string(),
  charStart: z.number().int().nonnegative(),
  charEnd: z.number().int().nonnegative(),
  score: z.number(),
  candidateNo: z.number().int().positive(),
  channels: z.array(z.enum(["fts", "vector"])).min(1),
  requirementLinks: z.array(z.object({
    requirementId: z.string(),
    requirementUrl: z.string(),
    source: z.string(),
  })).default([]),
});

const searchResponseSchema = z.object({
  query: z.string(),
  versionId: z.string().uuid(),
  version: z.string(),
  deploymentRef: z.string(),
  candidates: z.array(candidateSchema),
  thresholds: z.object({
    minimumVectorScore: z.number(),
    bothChannelsBonus: z.number(),
  }),
});

export type ScholarSearchCandidate = z.infer<typeof candidateSchema>;

@Injectable()
export class ScholarClient {
  async search(question: string, limit = 5): Promise<ScholarSearchCandidate[]> {
    const token = process.env.GATEWAY_ASSISTANT_SERVICE_TOKEN ?? process.env.GATEWAY_TOKEN;
    const response = await fetch(GATEWAY_URL() + "/api/scholar/public/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "x-access-token": token } : {}) },
      body: JSON.stringify({ q: question, limit }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404) return [];
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((body as { message?: string }).message || "Scholar 检索失败 " + response.status);
    }
    const parsed = searchResponseSchema.safeParse(body);
    if (!parsed.success) throw new Error("Scholar 检索结果格式非法");
    return parsed.data.candidates;
  }
}
