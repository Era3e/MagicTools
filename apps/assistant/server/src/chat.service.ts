import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type Citation, createConversation, getConversation, insertMessage, listMessages, touchConversation } from "./conversation.repo";
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
    @Inject(CybercloudService) private readonly cybercloud: CybercloudService
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
    if (intent === "product_inquiry") {
      const result = await this.knowledge.answer(message);
      reply = result.reply;
      citations = result.citations;
    } else if (intent === "data_query") {
      const ds = this.cybercloud.status();
      if (ds.stub || ds.configured) {
        reply = (await this.cybercloud.query(message)).reply;
      } else {
        reply = DATA_QUERY_DEGRADE;
      }
    } else {
      reply = CHITCHAT_REPLY;
    }

    await insertMessage({ conversationId, role: "assistant", content: reply, intent, citations });
    await touchConversation(conversationId);
    return { sessionId: conversationId, reply, intent, citations };
  }
}
