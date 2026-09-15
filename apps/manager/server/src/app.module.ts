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
import { ExecutionJobsController } from "./execution-jobs.controller";
import { ExecutionJobsService } from "./execution-jobs.service";
import { ExecutionNotificationsController } from "./execution-notifications.controller";
import { ExecutionNotificationsService } from "./execution-notifications.service";

@Module({
  controllers: [HealthController, RequirementController, IterationController, WebhookController, ImportController, CapabilityController, RequirementApprovalController, ExecutionJobsController, ExecutionNotificationsController],
  providers: [RequirementService, IterationService, ImportService, RequirementApprovalService, ExecutionJobsService, ExecutionNotificationsService],
})
export class AppModule {}
