import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ChatService } from "./chat.service";

@Controller()
export class ChatController {
  constructor(@Inject(ChatService) private readonly service: ChatService) {}

  @Post("chat")
  chat(@Body() body: unknown) {
    return this.service.chat(body);
  }
}
