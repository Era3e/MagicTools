import { Module } from "@nestjs/common";
import { ActionService } from "./action.service";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { CybercloudService } from "./cybercloud.service";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";
import { HealthController } from "./health.controller";
import { IntentService } from "./intent.service";
import { KnowledgeService } from "./knowledge.service";
import { MetaController } from "./meta.controller";
import { TroubleService } from "./trouble.service";

@Module({
  controllers: [HealthController, ChatController, MetaController, FeedbackController],
  providers: [ChatService, IntentService, KnowledgeService, CybercloudService, ActionService, TroubleService, FeedbackService],
})
export class AppModule {}
