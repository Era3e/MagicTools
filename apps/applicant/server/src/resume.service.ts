import { Injectable, NotFoundException } from "@nestjs/common";
import { getPosition } from "./position.repo";
import { ClawcvClient } from "./clawcv/client";
import { analyzeResumeFallback, matchResumeFallback, rewriteSectionFallback } from "./clawcv/fallback";
import { appendRewrite, createResume, getResume, listResumes, saveMatch, setResumeAnalysis, setResumeSession, type ResumeRow } from "./resume.repo";

const clawcv = new ClawcvClient();

@Injectable()
export class ResumeService {
  list() {
    return listResumes();
  }

  create(input: { name: string; contentText: string }) {
    return createResume(input);
  }

  async analyze(id: string) {
    const resume = await this.requireResume(id);
    let analysis: Record<string, unknown>;
    let via = "clawcv";
    if (clawcv.isConfigured()) {
      try {
        const sessionId = resume.clawcvSessionId ?? (await clawcv.createSession());
        if (!resume.clawcvSessionId) await setResumeSession(id, sessionId);
        analysis = await clawcv.analyze({ resume_text: resume.contentText, language: "zh", session_id: sessionId });
      } catch (err) {
        console.warn("[resume] ClawCV analyze 失败，降级本地: " + String(err));
        analysis = await analyzeResumeFallback(resume.contentText);
        via = "local";
      }
    } else {
      analysis = await analyzeResumeFallback(resume.contentText);
      via = "local";
    }
    await setResumeAnalysis(id, { ...analysis, via });
    return { ...analysis, via };
  }

  async rewrite(id: string, input: { sectionType: string; originalText: string; positionId?: string }) {
    const resume = await this.requireResume(id);
    let result: Record<string, unknown>;
    let via = "clawcv";
    if (clawcv.isConfigured()) {
      try {
        const sessionId = resume.clawcvSessionId ?? (await clawcv.createSession());
        result = await clawcv.rewrite({ section_type: input.sectionType, original_text: input.originalText, language: "zh", session_id: sessionId });
      } catch (err) {
        console.warn("[resume] ClawCV rewrite 失败，降级本地: " + String(err));
        result = await rewriteSectionFallback(input.sectionType, input.originalText);
        via = "local";
      }
    } else {
      result = await rewriteSectionFallback(input.sectionType, input.originalText);
      via = "local";
    }
    const rewrites: unknown[] = (result.rewrites as unknown[]) ?? [];
    const rewrittenText = typeof rewrites[0] === "string" ? (rewrites[0] as string) : JSON.stringify(rewrites[0] ?? {});
    await appendRewrite({ resumeId: id, positionId: input.positionId, sectionType: input.sectionType, originalText: input.originalText, rewrittenText });
    return { ...result, rewrittenText, via };
  }

  async match(id: string, positionId: string) {
    const resume = await this.requireResume(id);
    const position = await getPosition(positionId);
    if (!position) throw new NotFoundException("岗位不存在");
    let result: Record<string, unknown>;
    let via = "clawcv";
    if (clawcv.isConfigured()) {
      try {
        const sessionId = resume.clawcvSessionId ?? (await clawcv.createSession());
        result = await clawcv.match({
          resume_text: resume.contentText,
          job_description: position.jdRaw || position.title,
          target_job_title: position.title,
          language: "zh",
          session_id: sessionId,
        });
      } catch (err) {
        console.warn("[resume] ClawCV match 失败，降级本地: " + String(err));
        result = await matchResumeFallback(resume.contentText, position.jdRaw || position.title);
        via = "local";
      }
    } else {
      result = await matchResumeFallback(resume.contentText, position.jdRaw || position.title);
      via = "local";
    }
    const score = typeof result.match_score === "number" ? result.match_score : 0;
    await saveMatch({
      resumeId: id,
      positionId,
      matchScore: score,
      gaps: (result.gaps as unknown[]) ?? [],
      missingKeywords: (result.missing_keywords as string[]) ?? [],
    });
    return { ...result, via };
  }

  async quota() {
    if (!clawcv.isConfigured()) return { configured: false, quota: null };
    try {
      return { configured: true, quota: await clawcv.getQuota() };
    } catch (err) {
      return { configured: true, quota: null, error: String(err) };
    }
  }

  private async requireResume(id: string): Promise<ResumeRow> {
    const resume = await getResume(id);
    if (!resume) throw new NotFoundException("简历不存在");
    return resume;
  }
}
