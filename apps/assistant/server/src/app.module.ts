import { Module } from "@nestjs/common";
import { ActionService } from "./action.service";
import { BadcaseController } from "./badcase.controller";
import { BadcaseService } from "./badcase.service";
import { ManagerClient } from "./manager.client";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { CybercloudService } from "./cybercloud.service";
import { DirectQueryService } from "./direct-query.service";
import { EvaluationService } from "./evaluation.service";
import { EvaluationSuiteController } from "./evaluation-suite.controller";
import { EvaluationSuiteService } from "./evaluation-suite.service";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";
import { FinetuneService } from "./finetune.service";
import { HealthController } from "./health.controller";
import { IntentLogController } from "./intent-log.controller";
import { IntentService } from "./intent.service";
import { KnowledgeService } from "./knowledge.service";
import { ScholarClient } from "./scholar.client";
import { MetaController } from "./meta.controller";
import { TroubleService } from "./trouble.service";

@Module({
  controllers: [HealthController, ChatController, MetaController, FeedbackController, IntentLogController, EvaluationSuiteController, BadcaseController],
  providers: [ChatService, IntentService, KnowledgeService, ScholarClient, CybercloudService, DirectQueryService, ActionService, TroubleService, FeedbackService, EvaluationService, EvaluationSuiteService, FinetuneService, ManagerClient, BadcaseService],
})
export class AppModule {}
