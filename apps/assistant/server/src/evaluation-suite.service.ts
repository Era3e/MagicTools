import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ActionService } from "./action.service";
import {
  buildConfigSnapshot,
  buildDatasetFingerprint,
  compareEvaluationItems,
  scoreActionCase,
  scoreKnowledgeCase,
  scoreRoutingCase,
  type EvaluationItemStatus,
  type EvaluationSplit,
} from "./evaluation-scoring";
import {
  createEvaluationRun,
  failEvaluationRun,
  finishEvaluationRun,
  getEvaluationRun,
  insertEvaluationRunItem,
  listEvaluationCases,
  listEvaluationRunItems,
  listEvaluationRuns,
  listMissingCaseIds,
  recoverAbandonedEvaluationRuns,
  touchEvaluationRun,
  type EvaluationCaseRow,
} from "./evaluation-suite.repo";
import { IntentService } from "./intent.service";
import { KnowledgeService } from "./knowledge.service";

class EvaluationTimeoutError extends Error {
  constructor() {
    super("评测执行超时");
  }
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new EvaluationTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function emptyCountRecord() {
  return { dev: 0, regression: 0, holdout: 0 };
}

function emptyTypeCountRecord() {
  return { routing: 0, knowledge: 0, action: 0 };
}

function validateExpected(item: EvaluationCaseRow): void {
  const expected = item.expected as Record<string, unknown>;
  const requireKeys = (keys: string[]) => {
    for (const key of keys) {
      if (expected[key] === undefined || expected[key] === null || expected[key] === "") {
        throw new BadRequestException(`评测样本 ${item.caseKey} 缺少 ${key} 期望值`);
      }
    }
  };
  if (item.caseType === "routing") requireKeys(["domain", "intent"]);
  else if (item.caseType === "action") requireKeys(["action"]);
}

@Injectable()
export class EvaluationSuiteService {
  constructor(
    @Inject(IntentService) private readonly intents: IntentService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(ActionService) private readonly actions: ActionService
  ) {}

  onModuleInit() {
    void this.recoverAbandonedRuns().catch(() => undefined);
  }

  async recoverAbandonedRuns(): Promise<number> {
    const raw = Number(process.env.EVALUATION_RUN_STALE_MS ?? "900000");
    const staleMs = Number.isFinite(raw) && raw >= 1000 ? raw : 900000;
    return recoverAbandonedEvaluationRuns(staleMs);
  }

  async cases() {
    const cases = await listEvaluationCases();
    const bySplit = emptyCountRecord();
    const byType = emptyTypeCountRecord();
    for (const item of cases) {
      bySplit[item.split] += 1;
      byType[item.caseType] += 1;
    }
    return { total: cases.length, bySplit, byType };
  }

  async run(split: EvaluationSplit, label: string) {
    const cases = await listEvaluationCases(split);
    if (cases.length === 0) throw new BadRequestException("该 split 没有启用评测样本");
    for (const item of cases) validateExpected(item);
    const fingerprint = buildDatasetFingerprint(cases);
    const config = buildConfigSnapshot();
    const snapshot = config as unknown as Record<string, unknown>;
    const run = await createEvaluationRun({
      split,
      label,
      datasetFingerprint: fingerprint,
      configSnapshot: snapshot,
      expectedTotal: cases.length,
    });

    try {
      for (const item of cases) {
        const started = Date.now();
        let status: EvaluationItemStatus;
        let actual: Record<string, unknown>;
        let reason = "";
        try {
          const output = await withTimeout(this.executeCase(item), config.timeoutMs);
          actual = output.actual;
          const score = output.score;
          status = score.status;
          reason = score.reason;
        } catch (error) {
          actual = {};
          if (error instanceof EvaluationTimeoutError) {
            status = "timeout";
            reason = error.message;
          } else {
            status = "error";
            reason = error instanceof Error ? error.message : String(error);
          }
        }
        await insertEvaluationRunItem({
          runId: run.id,
          caseId: item.id,
          caseKey: item.caseKey,
          caseType: item.caseType,
          status,
          latencyMs: Date.now() - started,
          actual,
          expected: item.expected,
          reason,
        });
        await touchEvaluationRun(run.id);
      }

      for (const missing of await listMissingCaseIds(run.id, cases)) {
        await insertEvaluationRunItem({
          runId: run.id,
          caseId: missing.id,
          caseKey: missing.caseKey,
          caseType: missing.caseType,
          status: "missing",
          latencyMs: 0,
          actual: {},
          expected: missing.expected,
          reason: "运行结束仍缺少明细",
        });
      }
      const finished = await finishEvaluationRun(run.id, cases.length);
      if (!finished) throw new Error(`评测明细数量不符：expected ${cases.length}`);
      const itemCount =
        finished.passCount + finished.failCount + finished.errorCount + finished.timeoutCount + finished.missingCount;
      if (itemCount !== finished.expectedTotal) {
        throw new Error(`评测明细数量不符：expected ${finished.expectedTotal}, actual ${itemCount}`);
      }
      return { ...finished, itemCount };
    } catch (error) {
      await failEvaluationRun(run.id, error);
      throw error;
    }
  }

  private executeCase(item: EvaluationCaseRow): Promise<{ actual: Record<string, unknown>; score: { status: "pass" | "fail"; reason: string } }> {
    if (item.caseType === "routing") {
      return this.intents
        .classify(item.message, item.history)
        .then((actual) => ({
          actual: { ...actual },
          score: scoreRoutingCase(item.expected as unknown as Parameters<typeof scoreRoutingCase>[0], actual),
        }));
    }
    if (item.caseType === "knowledge") {
      return this.knowledge
        .answer(item.message)
        .then((actual) => ({
          actual: { reply: actual.reply, citations: actual.citations },
          score: scoreKnowledgeCase(item.expected as unknown as Parameters<typeof scoreKnowledgeCase>[0], actual),
        }));
    }
    return this.actions
      .parse(item.message)
      .then((actual) => ({
        actual: { ...actual },
        score: scoreActionCase(item.expected as unknown as Parameters<typeof scoreActionCase>[0], actual),
      }));
  }

  async listRuns() {
    return listEvaluationRuns();
  }

  async runDetail(id: string) {
    const run = await getEvaluationRun(id);
    if (!run) throw new NotFoundException("评测 run 不存在");
    const items = await listEvaluationRunItems(id);
    if (run.split === "holdout") {
      return {
        ...run,
        itemCount: items.length,
        items: items.map((item) => ({
          id: item.id,
          caseKey: item.caseKey,
          caseType: item.caseType,
          status: item.status,
          latencyMs: item.latencyMs,
        })),
      };
    }
    return { ...run, itemCount: items.length, items };
  }

  async compare(baselineId: string, currentId: string) {
    const baseline = await getEvaluationRun(baselineId);
    const current = await getEvaluationRun(currentId);
    if (!baseline) throw new NotFoundException("baseline run 不存在");
    if (!current) throw new NotFoundException("current run 不存在");
    if (baseline.split !== current.split) throw new BadRequestException("两个 run 的 split 不一致");
    if (baseline.datasetFingerprint !== current.datasetFingerprint) {
      throw new BadRequestException("两个 run 的数据集指纹不一致，拒绝比较");
    }
    const baselineItems = await listEvaluationRunItems(baseline.id);
    const currentItems = await listEvaluationRunItems(current.id);
    for (const run of [baseline, current]) {
      if (run.status !== "completed" || run.expectedTotal !== (await listEvaluationRunItems(run.id)).length) {
        throw new BadRequestException("只能比较明细完整的 completed run");
      }
    }
    const result = compareEvaluationItems(
      new Map(baselineItems.map((item) => [item.caseId, item.status])),
      new Map(currentItems.map((item) => [item.caseId, item.status]))
    );
    return {
      baseline: { id: baseline.id, label: baseline.label, split: baseline.split, datasetFingerprint: baseline.datasetFingerprint, configSnapshot: baseline.configSnapshot },
      current: { id: current.id, label: current.label, split: current.split, datasetFingerprint: current.datasetFingerprint, configSnapshot: current.configSnapshot },
      summary: result.summary,
      transitions: result.transitions,
    };
  }
}
