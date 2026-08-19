import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { RequirementController } from "./requirement.controller";
import { RequirementService } from "./requirement.service";

@Module({
  controllers: [HealthController, RequirementController],
  providers: [RequirementService],
})
export class AppModule {}
