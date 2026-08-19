import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { InterviewController } from "./interview.controller";
import { InterviewService } from "./interview.service";
import { PositionController } from "./position.controller";
import { PositionService } from "./position.service";

@Module({
  controllers: [HealthController, PositionController, InterviewController],
  providers: [PositionService, InterviewService],
})
export class AppModule {}
