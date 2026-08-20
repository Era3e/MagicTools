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
import { IntentService } from "./intent.service";
import { KnowledgeService } from "./knowledge.service";
import { chatInputSchema } from "./schemas";

const CHITCHAT_REPLY =
  "我是智能助手，目前可以：1）回答产品/知识问题（基于 Scholar 圈定内容）；2）查询数据指标（需配置数据源）。试试问我产品功能或数据问题吧。";
const DATA_QUERY_DEGRADE = "数据查询暂未配置（CYBERCLOUD 未配置），请稍后重试或联系管理员。";

@Injectable()
export class ChatService {
  constructor(
    @Inject(IntentService) private readonly intentService: IntentService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(CybercloudService) private readonly cybercloud: CybercloudService,
    @Inject(ActionService) private readonly actions: ActionService
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

    const intent = await this.intentService.classify(
      message,
      history.map((m) => ({ role: m.role, content: m.content }))
    );

    let reply = "";
    let citations: Citation[] = [];
    let actionResult: Record<string, unknown> = {};
    if (intent === "product_inquiry") {
      // 检索时带上最近用户消息，帮助指代消解（如「那它的供应链呢」）
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
    } else {
      reply = CHITCHAT_REPLY;
    }

    await insertMessage({ conversationId, role: "assistant", content: reply, intent, citations });
    await touchConversation(conversationId);
    return { sessionId: conversationId, reply, intent, citations, actionResult };
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
