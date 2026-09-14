import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { getFeedback } from "./feedback.repo";
import { ManagerClient } from "./manager.client";
import { EvaluationSuiteService } from "./evaluation-suite.service";
import { getEvaluationCaseByCaseKey } from "./evaluation-suite.repo";
import { getBadcase, insertBadcase, insertRegressionCase, listBadcases, updateBadcase, type BadcaseRow } from "./badcase.repo";
import type { EvaluationRunItemRow } from "./evaluation-suite.repo";

@Injectable()
export class BadcaseService {
  constructor(
    @Inject(EvaluationSuiteService) private readonly evaluation: EvaluationSuiteService,
    @Inject(ManagerClient) private readonly manager: ManagerClient
  ) {}

  list(status?: BadcaseRow["status"]) {
    return listBadcases(status);
  }

  async get(id: string) {
    const row = await getBadcase(id);
    if (!row) throw new NotFoundException("badcase 不存在");
    return row;
  }

  async fromFeedback(feedbackId: string) {
    const feedback = await getFeedback(feedbackId);
    if (!feedback) throw new NotFoundException("反馈不存在");
    return insertBadcase({
      source: "user_feedback",
      stage: "other",
      title: feedback.content.slice(0, 80) || "用户反馈 badcase",
      description: feedback.content,
      evidence: { feedback },
      traceId: feedback.traceId,
      conversationId: feedback.conversationId,
      userMessageId: feedback.userMessageId,
      intentLogId: feedback.intentLogId,
      feedbackId: feedback.id,
    });
  }

  async createFromClarify(input: {
    title: string; description: string; evidence: Record<string, unknown>;
    traceId: string; conversationId: string; userMessageId: string; assistantMessageId: string; intentLogId: string;
  }) {
    return insertBadcase({
      source: "user_clarify",
      stage: "routing",
      title: input.title || "低置信度路由待确认",
      description: input.description,
      severity: "medium",
      evidence: input.evidence,
      traceId: input.traceId,
      conversationId: input.conversationId,
      userMessageId: input.userMessageId,
      assistantMessageId: input.assistantMessageId,
      intentLogId: input.intentLogId,
    });
  }

  async fromEvaluationRun(runId: string, caseKey: string) {
    const run = await this.evaluation.runDetail(runId);
    if (run.split === "holdout") throw new BadRequestException("holdout 明细不能创建 badcase");
    const item = run.items.find((row) => row.caseKey === caseKey);
    if (!item) throw new NotFoundException("评测明细不存在");
    if (item.status === "pass") throw new BadRequestException("通过的评测明细不能创建 badcase");
    const evidence = run.items.find((row) => row.caseKey === caseKey) as EvaluationRunItemRow | undefined;
    const evaluationCase = await getEvaluationCaseByCaseKey(caseKey);
    if (!evidence || !evaluationCase) throw new NotFoundException("评测明细不存在");
    return insertBadcase({
      source: "evaluation",
      stage: evidence.caseType,
      title: `评测失败：${evidence.caseKey}`,
      description: evidence.reason || evidence.status,
      severity: evidence.status === "error" || evidence.status === "timeout" ? "high" : "medium",
      evidence: { runId, item: evidence, message: evaluationCase.message, history: evaluationCase.history },
      evaluationRunId: runId,
      evaluationRunItemId: evidence.id,
    });
  }

  async confirm(id: string, input: { title: string; description?: string; stage: BadcaseRow["stage"]; severity: BadcaseRow["severity"]; expected: Record<string, unknown> }) {
    const row = await getBadcase(id);
    if (!row) throw new NotFoundException("badcase 不存在");
    if (!["new", "confirmed", "classified"].includes(row.status)) throw new BadRequestException("当前状态不能确认分类");
    this.validateExpected(input.stage, input.expected);
    const updated = await updateBadcase(id, {
      status: "classified", title: input.title, description: input.description ?? row.description,
      stage: input.stage, severity: input.severity, expected: input.expected,
    });
    return updated;
  }

  async createRegression(id: string) {
    const row = await this.get(id);
    if (!["classified", "confirmed"].includes(row.status)) throw new BadRequestException("请先确认 badcase 分类");
    if (row.evaluationCaseId || row.baselineRunId) return row;
    const evidence = row.evidence as {
      message?: string; history?: Array<{ role: "user" | "assistant"; content: string }>;
    };
    const message = evidence.message;
    if (!message) throw new BadRequestException("badcase 证据缺少原始消息");
    const caseType = row.stage === "knowledge" ? "knowledge" : row.stage === "action" ? "action" : "routing";
    const caseId = await insertRegressionCase({
      caseKey: `badcase-${row.id}-v1`,
      caseType,
      message,
      history: evidence.history ?? [],
      expected: row.expected ?? {},
      sourceRef: `badcase:${row.id}`,
    });
    const baseline = await this.evaluation.run("regression", `badcase-${row.id}-baseline`);
    const detail = await this.evaluation.runDetail(baseline.id);
    const item = (detail.items as EvaluationRunItemRow[]).find((entry) => entry.caseId === caseId);
    if (!item) throw new BadRequestException("baseline 缺少 badcase 明细");
    if (item.status === "pass") {
      await updateBadcase(id, { status: "rejected", baselineRunId: baseline.id, closedReason: "baseline 已经通过，不是有效 badcase" });
      throw new BadRequestException("baseline 已经通过，不能作为修复前失败证据");
    }
    return updateBadcase(id, { status: "regression_ready", evaluationCaseId: caseId, baselineRunId: baseline.id });
  }

  async createRequirement(id: string) {
    const row = await this.get(id);
    if (row.status !== "regression_ready") throw new BadRequestException("请先生成回归样本和修复前 baseline");
    if (row.requirementId) return row;
    const requirement = await this.manager.createBadcaseRequirement({
      badcaseId: row.id,
      title: row.title,
      description: row.description,
      evidence: { ...row.evidence, badcaseId: row.id, baselineRunId: row.baselineRunId },
      acceptanceCriteria: [
        `回归样本 ${row.evaluationCaseId ?? "missing"} 在当前 regression run 中通过`,
        `baseline run ${row.baselineRunId ?? "missing"} 与当前 run 数据集指纹一致`,
        "当前 run 无 regressed/error/timeout/missing",
      ],
    });
    return updateBadcase(id, { status: "fix_planned", requirementId: requirement.id, requirementUrl: requirement.url });
  }

  async close(id: string, input: { fixPrUrl: string; verificationRunId: string }) {
    const row = await this.get(id);
    if (!row.evaluationCaseId || !row.baselineRunId) throw new BadRequestException("badcase 缺少回归样本或 baseline");
    if (!row.requirementId) throw new BadRequestException("badcase 未关联 Manager 需求");
    if (!/https:\/\/github\.com\/[^\s]+\/pull\/\d+/u.test(input.fixPrUrl)) throw new BadRequestException("修复 PR 链接非法");
    const comparison = await this.evaluation.compare(row.baselineRunId, input.verificationRunId);
    if (comparison.summary.regressed || comparison.summary.error || comparison.summary.timeout || comparison.summary.missing) {
      throw new BadRequestException("当前 run 存在回归或异常，不能关闭 badcase");
    }
    const current = await this.evaluation.runDetail(input.verificationRunId);
    const item = (current.items as EvaluationRunItemRow[]).find((entry) => entry.caseId === row.evaluationCaseId);
    if (!item || item.status !== "pass") throw new BadRequestException("目标回归样本未通过");
    const requirement = await this.manager.getRequirement(row.requirementId);
    if (!requirement || !requirement.prUrl) throw new BadRequestException("Manager 需求未关联修复 PR");
    if (requirement.prUrl !== input.fixPrUrl) throw new BadRequestException("修复 PR 与 Manager 需求关联 PR 不一致");
    if (!["accepting", "done"].includes(requirement.status)) throw new BadRequestException("Manager 需求未进入验收或完成状态");
    return updateBadcase(id, {
      status: "closed", fixPrUrl: input.fixPrUrl, verificationRunId: input.verificationRunId,
      closedReason: "回归通过与修复 PR 验收通过",
    });
  }

  private validateExpected(stage: BadcaseRow["stage"], expected: Record<string, unknown>) {
    if (stage === "routing" && (!expected.domain || !expected.intent)) throw new BadRequestException("routing expected 缺少 domain/intent");
    if (stage === "action" && !expected.action) throw new BadRequestException("action expected 缺少 action");
    if (stage === "knowledge" && !Array.isArray(expected.contains)) throw new BadRequestException("knowledge expected 缺少 contains");
  }
}
