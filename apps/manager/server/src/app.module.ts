import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { IterationController } from "./iteration.controller";
import { IterationService } from "./iteration.service";
import { RequirementController } from "./requirement.controller";
import { RequirementService } from "./requirement.service";
import { WebhookController } from "./webhook.controller";

@Module({
  controllers: [HealthController, RequirementController, IterationController, WebhookController],
  providers: [RequirementService, IterationService],
})
export class AppModule {}
