import { Body, Controller, Delete, Get, Inject, Param, Post } from "@nestjs/common";
import { ChatService } from "./chat.service";

@Controller()
export class ChatController {
  constructor(@Inject(ChatService) private readonly service: ChatService) {}

  @Post("chat")
  chat(@Body() body: unknown) {
    return this.service.chat(body);
  }

  @Get("conversations")
  list() {
    return this.service.listConversations();
  }

  @Get("conversations/:id/messages")
  messages(@Param("id") id: string) {
    return this.service.getMessages(id);
  }

  @Delete("conversations/:id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
