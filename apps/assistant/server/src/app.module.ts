import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { HealthController } from "./health.controller";
import { IntentService } from "./intent.service";
import { KnowledgeService } from "./knowledge.service";

@Module({
  controllers: [HealthController, ChatController],
  providers: [ChatService, IntentService, KnowledgeService],
})
export class AppModule {}
