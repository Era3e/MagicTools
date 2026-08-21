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
import { CybercloudService } from "./cybercloud.service";
import { FeedbackService } from "./feedback.service";
import { correctIntentLog, insertIntentLog } from "./intent-log.repo";
import type { Intent } from "./llm";
import { IntentService } from "./intent.service";
import { KnowledgeService } from "./knowledge.service";
import { chatInputSchema } from "./schemas";
import { TroubleService } from "./trouble.service";

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

  constructor(
    @Inject(IntentService) private readonly intentService: IntentService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(CybercloudService) private readonly cybercloud: CybercloudService,
    @Inject(ActionService) private readonly actions: ActionService,
    @Inject(TroubleService) private readonly trouble: TroubleService,
    @Inject(FeedbackService) private readonly feedback: FeedbackService
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
    await insertMessage({ conversationId, role: "user", content: message, intent: "", citations: [] });

    // 澄清确认：上一轮低置信度反问后，用户按序号/意图确认
    const pending = this.pendingClarify.get(conversationId);
    if (pending) {
      const chosen = resolveClarify(message, pending.options);
      if (chosen) {
        await correctIntentLog(pending.intentLogId, chosen);
        this.pendingClarify.delete(conversationId);
        const result = await this.executeBranch(chosen, pending.originalMessage, history);
        await insertMessage({ conversationId, role: "assistant", content: result.reply, intent: chosen, citations: result.citations });
        await touchConversation(conversationId);
        return {
          sessionId: conversationId,
          reply: result.reply,
          intent: chosen,
          clarifying: false,
          citations: result.citations,
          actionResult: result.actionResult,
        };
      }
      this.pendingClarify.delete(conversationId);
    }

    const route = await this.intentService.classify(
      message,
      history.map((m) => ({ role: m.role, content: m.content }))
    );
    const intent = route.intent;
    const log = await insertIntentLog({ message, domain: route.domain, intent: route.intent, confidence: route.confidence });

    const threshold = Number(process.env.CLARIFY_THRESHOLD ?? "0.6");
    if (route.confidence < threshold && intent !== "chitchat_reject") {
      const options = buildClarifyOptions(intent);
      const reply = "我不太确定你的意思，请选择：\n" + options.map((o) => o.label).join("\n");
      this.pendingClarify.set(conversationId, { intentLogId: log.id, options, originalMessage: message });
      await insertMessage({ conversationId, role: "assistant", content: reply, intent, citations: [] });
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

    const result = await this.executeBranch(intent, message, history);
    const reply = result.reply;
    const citations = result.citations;
    const actionResult = result.actionResult;
    await insertMessage({ conversationId, role: "assistant", content: reply, intent, citations });
    await touchConversation(conversationId);
    return { sessionId: conversationId, reply, intent, domain: route.domain, confidence: route.confidence, clarifying: false, citations, actionResult };
  }

  private async executeBranch(
    intent: Intent,
    message: string,
    history: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<{ reply: string; citations: Citation[]; actionResult: Record<string, unknown> }> {
    let reply = "";
    let citations: Citation[] = [];
    let actionResult: Record<string, unknown> = {};
    if (intent === "product_inquiry") {
      // 检索时带上最近用户消息，帮助指代消解（如「那它有什么动作呢」）
      const searchQuery = [
        ...history.filter((h) => h.role === "user").map((h) => h.content).slice(-2),
        message,
      ].join("；");
      const result = await this.knowledge.answer(searchQuery);
      reply = result.reply;
      citations = result.citations;
    } else if (intent === "data_query") {
      const ds = this.cybercloud.status();
      if (ds.stub || ds.configured) {
        reply = (await this.cybercloud.query(message)).reply;
      } else {
        reply = DATA_QUERY_DEGRADE;
      }
    } else if (intent === "process_execution") {
      const result = await this.actions.execute(message);
      reply = result.reply;
      actionResult = result.actionResult;
    } else if (intent === "trouble_shooting") {
      reply = (await this.trouble.diagnose(message)).reply;
    } else if (intent === "complaint_feedback") {
      reply = (await this.feedback.collect(message)).reply;
    } else {
      reply = CHITCHAT_REPLY;
    }
    return { reply, citations, actionResult };
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