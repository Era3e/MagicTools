import { llmChat } from "../llm";

export async function analyzeResumeFallback(resumeText: string): Promise<Record<string, unknown>> {
  const raw = await llmChat([
    { role: "system", content: "你是简历教练。输出 JSON：{score: 数字, strengths: 字符串数组, weaknesses: 字符串数组, suggestions: 字符串数组}，只输出 JSON。" },
    { role: "user", content: "分析这份简历：" + resumeText.slice(0, 4000) },
  ]);
  return JSON.parse(raw);
}

export async function rewriteSectionFallback(sectionType: string, originalText: string): Promise<Record<string, unknown>> {
  const raw = await llmChat([
    { role: "system", content: "你是简历优化助手，用 STAR 法则改写。输出 JSON：{rewrites: 字符串数组, editing_notes: 字符串数组}，只输出 JSON。" },
    { role: "user", content: "段落类型：" + sectionType + "；原文：" + originalText.slice(0, 3000) },
  ]);
  return JSON.parse(raw);
}

export async function matchResumeFallback(resumeText: string, jdText: string): Promise<Record<string, unknown>> {
  const raw = await llmChat([
    { role: "system", content: "你是简历匹配助手。输出 JSON：{match_score: 0-100 数字, strengths: 数组, gaps: 数组, missing_keywords: 数组, recommended_changes: 数组}，只输出 JSON。" },
    { role: "user", content: "简历：" + resumeText.slice(0, 3000) + "\n\nJD：" + jdText.slice(0, 3000) },
  ]);
  return JSON.parse(raw);
}
