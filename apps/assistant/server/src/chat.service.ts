import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ActionService } from "./action.service";
import {
  type Citation,
  createConversation,
  deleteConversation,
  getConversation,
  insertMessage,
  listConversations,
  listMessages,
  touchConversation,
} from "./conversation.repo";
import { insertCybercloudCall } from "./cybercloud-calls.repo";
import { CybercloudService } from "./cybercloud.service";
import { DirectQueryService } from "./direct-query.service";
import { FeedbackService } from "./feedback.service";
import { attachIntentLogTrace, insertIntentLog, suggestIntentLog } from "./intent-log.repo";
import { BadcaseService } from "./badcase.service";
import { insertTrace, type TraceStage } from "./trace.repo";
import { runWithModelCallContext } from "@mt/model-client";
import type { Intent } from "./llm";
import { IntentService } from "./intent.service";
import { KnowledgeService } from "./knowledge.service";
import { chatInputSchema } from "./schemas";
import { TroubleService } from "./trouble.service";
import { VerifyTaskRegistry } from "./verify-task.registry";

const INTENT_LABEL: Record<string, string> = {
  product_inquiry: "知识问答",
  data_query: "数据查询 / cybercloud 域操作",
  process_execution: "创建需求或触发采集",
  trouble_shooting: "故障排查",
  complaint_feedback: "投诉反馈",
  chitchat_reject: "闲聊",
};

function buildClarifyOptions(intent: Intent): Array<{ label: string; intent: Intent }> {
  const alt: Intent = intent === "data_query" ? "process_execution" : "data_query";
  const options: Array<{ label: string; intent: Intent }> = [{ label: "1. " + INTENT_LABEL[intent], intent }];
  if (alt !== intent) options.push({ label: "2. " + INTENT_LABEL[alt], intent: alt });
  return options;
}

function resolveClarify(message: string, options: Array<{ label: string; intent: Intent }>): Intent | null {
  const trimmed = message.trim();
  const byNumber = options[Number(trimmed) - 1];
  if (byNumber) return byNumber.intent;
  const byIntent = options.find((o) => o.intent === trimmed);
  return byIntent ? byIntent.intent : null;
}

function traceStage(intent: Intent): TraceStage {
  if (intent === "product_inquiry") return "knowledge";
  if (intent === "data_query") return "data";
  if (intent === "process_execution") return "action";
  if (intent === "trouble_shooting") return "trouble";
  if (intent === "complaint_feedback") return "feedback";
  return "other";
}

const CHITCHAT_REPLY =
  "我是智能助手，目前可以：1）回答产品/知识问题（基于 Scholar 圈定内容）；2）查询数据指标（需配置数据源）。试试问我产品功能或数据问题吧。";
const DATA_QUERY_DEGRADE = "数据查询暂未配置（CYBERCLOUD 未配置），请稍后重试或联系管理员。";

interface PendingClarify {
  intentLogId: string;
  options: Array<{ label: string; intent: Intent }>;
  originalMessage: string;
}

@Injectable()
export class ChatService {
  private readonly pendingClarify = new Map<string, PendingClarify>();
  private readonly verifyRegistry = new VerifyTaskRegistry();

  constructor(
    @Inject(IntentService) private readonly intentService: IntentService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(CybercloudService) private readonly cybercloud: CybercloudService,
    @Inject(DirectQueryService) private readonly directQuery: DirectQueryService,
    @Inject(ActionService) private readonly actions: ActionService,
    @Inject(TroubleService) private readonly trouble: TroubleService,
    @Inject(FeedbackService) private readonly feedback: FeedbackService,
    @Inject(BadcaseService) private readonly badcases: BadcaseService
  ) {}

  async chat(input: unknown) {
    const parsed = chatInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("message 必填");
    const { sessionId, message } = parsed.data;

    let conversationId = sessionId;
    if (!conversationId) {
      conversationId = (await createConversation(message.slice(0, 30))).id;
    } else if (!(await getConversation(conversationId))) {
      throw new NotFoundException("会话不存在");
    }

    const history = await listMessages(conversationId, 20);
    const userMessage = await insertMessage({ conversationId, role: "user", content: message, intent: "", citations: [] });
    const requestContext = { service: "assistant", metadata: { conversationId, userMessageId: userMessage.id } };

    // 澄清确认：上一轮低置信度反问后，用户按序号/意图确认
    const pending = this.pendingClarify.get(conversationId);
    if (pending) {
      const chosen = resolveClarify(message, pending.options);
      if (chosen) {
        await suggestIntentLog(pending.intentLogId, chosen);
        this.pendingClarify.delete(conversationId);
        const result = await runWithModelCallContext(
          { ...requestContext, traceId: pending.intentLogId, taskId: pending.intentLogId },
          () => this.executeBranch(chosen, pending.originalMessage, history, {
            conversationId, userMessageId: userMessage.id, intentLogId: pending.intentLogId,
          })
        );
        const assistantMessage = await insertMessage({ conversationId, role: "assistant", content: result.reply, intent: chosen, citations: result.citations });
        await insertTrace({
          conversationId,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
          intentLogId: pending.intentLogId,
          stage: traceStage(chosen),
          status: "completed",
          route: { domain: "magictools", intent: chosen },
          result: { ...result },
        });
        await touchConversation(conversationId);
        return {
          sessionId: conversationId,
          reply: result.reply,
          intent: chosen,
          clarifying: false,
          citations: result.citations,
          actionResult: result.actionResult,
          verify: result.verify,
          dataSource: result.dataSource,
        };
      }
      this.pendingClarify.delete(conversationId);
    }

    const route = await runWithModelCallContext(
      { ...requestContext, operation: "intent-classification" },
      () => this.intentService.classify(
        message,
        history.map((m) => ({ role: m.role, content: m.content }))
      )
    );
    const intent = route.intent;
    const log = await insertIntentLog({ message, domain: route.domain, intent: route.intent, confidence: route.confidence });

    const threshold = Number(process.env.CLARIFY_THRESHOLD ?? "0.6");
    if (route.confidence < threshold && intent !== "chitchat_reject") {
      const options = buildClarifyOptions(intent);
      const reply = "我不太确定你的意思，请选择：\n" + options.map((o) => o.label).join("\n");
      this.pendingClarify.set(conversationId, { intentLogId: log.id, options, originalMessage: message });
      const assistantMessage = await insertMessage({ conversationId, role: "assistant", content: reply, intent, citations: [] });
      const trace = await insertTrace({
        conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        intentLogId: log.id,
        stage: "routing",
        status: "clarifying",
        route: { ...route },
        result: { options },
      });
      await attachIntentLogTrace(log.id, trace.id);
      await this.badcases.createFromClarify({
        title: message.slice(0, 80),
        description: "低置信度路由需要管理员确认",
        evidence: { message, history, route, options },
        traceId: trace.id,
        conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        intentLogId: log.id,
      });
      await touchConversation(conversationId);
      return {
        sessionId: conversationId,
        reply,
        intent,
        domain: route.domain,
        confidence: route.confidence,
        clarifying: true,
        clarifyOptions: options,
        citations: [],
        actionResult: {},
      };
    }

    const feedbackContext = { conversationId, userMessageId: userMessage.id, intentLogId: log.id };
    let result;
    try {
      result = await runWithModelCallContext(
        { ...requestContext, traceId: log.id, taskId: log.id },
        () => this.executeBranch(intent, message, history, feedbackContext)
      );
    } catch (error) {
      await insertTrace({
        conversationId,
        userMessageId: userMessage.id,
        intentLogId: log.id,
        stage: traceStage(intent),
        status: "failed",
        route: { ...route },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    const reply = result.reply;
    const citations = result.citations;
    const actionResult = result.actionResult;
    const assistantMessage = await insertMessage({ conversationId, role: "assistant", content: reply, intent, citations });
    const trace = await insertTrace({
      conversationId,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      intentLogId: log.id,
      stage: traceStage(intent),
      status: "completed",
      route: { ...route },
      result: { reply, citations, actionResult, verify: result.verify, dataSource: result.dataSource },
    });
    await attachIntentLogTrace(log.id, trace.id);
    await touchConversation(conversationId);
    return { sessionId: conversationId, reply, intent, domain: route.domain, confidence: route.confidence, clarifying: false, citations, actionResult, verify: result.verify, dataSource: result.dataSource };
  }

  private async executeBranch(
    intent: Intent,
    message: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
    feedbackContext: { conversationId: string; userMessageId: string; intentLogId?: string }
  ): Promise<{ reply: string; citations: Citation[]; actionResult: Record<string, unknown>; verify?: { taskId?: string; status: string }; dataSource?: Record<string, unknown> }> {
    let reply = "";
    let citations: Citation[] = [];
    let actionResult: Record<string, unknown> = {};
    let verify: { taskId?: string; status: string } | undefined;
    let dataSource: Record<string, unknown> | undefined;
    if (intent === "product_inquiry") {
      // 检索时带上最近用户消息，帮助指代消解（如「那它有什么动作呢」）
      const historyParts = history.filter((h) => h.role === "user").map((h) => h.content).slice(-2);
      const searchQuery = [message, ...historyParts].join("；").slice(0, 500);
      const result = await this.knowledge.answer(searchQuery);
      reply = result.reply;
      citations = result.citations;
    } else if (intent === "data_query") {
      const ds = this.cybercloud.status();
      if (ds.stub || ds.configured) {
        const mode = process.env.CYBERCLOUD_MODE || "dual";
        if (mode === "agent") {
          const res = await this.cybercloud.query(message);
          reply = res.reply;
          dataSource = { mode: "agent", agent: res.meta };
        } else {
          const directPromise = this.directQuery.run(message);
          const agentPromise = mode === "dual" ? this.cybercloud.query(message) : null;
          const direct = await directPromise;
          const directMeta: Record<string, unknown> = direct.applicable
            ? { applicable: true, metricName: direct.metricName, value: direct.value, unit: direct.unit, latencyMs: direct.latencyMs, endpoint: direct.endpoint, timeFilter: direct.timeFilter }
            : { applicable: false, reasonCode: direct.reasonCode, latencyMs: direct.latencyMs };
          if (direct.applicable) {
            reply = direct.reply;
            void insertCybercloudCall({ route: "direct", endpoint: direct.endpoint ?? "", ok: true, latencyMs: direct.latencyMs, detail: { metric_name: direct.metricName, value: direct.value, time_filter: direct.timeFilter } }).catch(() => undefined);
            if (agentPromise) {
              const task = this.verifyRegistry.create({ directResult: direct, agentPromise });
              verify = { taskId: task.taskId, status: "pending" };
              dataSource = { mode: "dual", direct: directMeta };
            } else {
              verify = { status: "not_applicable" };
              dataSource = { mode: "direct", direct: directMeta };
            }
          } else {
            void insertCybercloudCall({ route: "direct", endpoint: "pipeline", ok: false, latencyMs: direct.latencyMs, error: direct.reasonCode, detail: { reason_code: direct.reasonCode } }).catch(() => undefined);
            try {
              const agentRes = await (agentPromise ?? this.cybercloud.query(message));
              reply = agentRes.reply;
              dataSource = { mode: mode === "direct" ? "direct-fallback-agent" : "dual", direct: directMeta, agent: { ...agentRes.meta, error: agentRes.meta.error ?? null } };
            } catch (err) {
              reply = DATA_QUERY_DEGRADE + "（智能体异常：" + (err instanceof Error ? err.message : String(err)) + "）";
              dataSource = { mode: "both-failed", direct: directMeta, agent: { error: err instanceof Error ? err.message : String(err) } };
            }
            verify = { status: "not_applicable" };
          }
        }
      } else {
        reply = DATA_QUERY_DEGRADE;
        dataSource = { mode: "degrade", direct: { applicable: false, reasonCode: "unconfigured" } };
      }
    } else if (intent === "process_execution") {
      const result = await this.actions.execute(message);
      reply = result.reply;
      actionResult = result.actionResult;
    } else if (intent === "trouble_shooting") {
      reply = (await this.trouble.diagnose(message)).reply;
    } else if (intent === "complaint_feedback") {
      reply = (await this.feedback.collect(message, feedbackContext)).reply;
    } else {
      reply = CHITCHAT_REPLY;
    }
    return { reply, citations, actionResult, verify, dataSource };
  }

  getVerify(taskId: string) {
    return this.verifyRegistry.get(taskId);
  }

  listConversations() {
    return listConversations();
  }

  async getMessages(id: string) {
    if (!(await getConversation(id))) throw new NotFoundException("会话不存在");
    return listMessages(id, 200);
  }

  async remove(id: string) {
    if (!(await deleteConversation(id))) throw new NotFoundException("会话不存在");
    return { deleted: true };
  }
}
