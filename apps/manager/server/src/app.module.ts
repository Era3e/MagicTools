import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { IterationController } from "./iteration.controller";
import { IterationService } from "./iteration.service";
import { RequirementController } from "./requirement.controller";
import { RequirementService } from "./requirement.service";

@Module({
  controllers: [HealthController, RequirementController, IterationController],
  providers: [RequirementService, IterationService],
})
export class AppModule {}
