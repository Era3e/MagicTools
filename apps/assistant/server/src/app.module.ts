import { Module } from "@nestjs/common";
import { ActionService } from "./action.service";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { CybercloudService } from "./cybercloud.service";
import { HealthController } from "./health.controller";
import { IntentService } from "./intent.service";
import { KnowledgeService } from "./knowledge.service";
import { MetaController } from "./meta.controller";
import { TroubleService } from "./trouble.service";

@Module({
  controllers: [HealthController, ChatController, MetaController],
  providers: [ChatService, IntentService, KnowledgeService, CybercloudService, ActionService, TroubleService],
})
export class AppModule {}
