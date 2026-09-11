import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { IterationController } from "./iteration.controller";
import { IterationService } from "./iteration.service";
import { RequirementController } from "./requirement.controller";
import { RequirementService } from "./requirement.service";
import { WebhookController } from "./webhook.controller";
import { CapabilityController, ImportController } from "./import.controller";
import { ImportService } from "./import.service";
import { RequirementApprovalController } from "./requirement-approval.controller";
import { RequirementApprovalService } from "./requirement-approval.service";

@Module({
  controllers: [HealthController, RequirementController, IterationController, WebhookController, ImportController, CapabilityController, RequirementApprovalController],
  providers: [RequirementService, IterationService, ImportService, RequirementApprovalService],
})
export class AppModule {}
