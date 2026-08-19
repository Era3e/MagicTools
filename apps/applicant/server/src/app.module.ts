import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { InterviewController } from "./interview.controller";
import { InterviewService } from "./interview.service";
import { PositionController } from "./position.controller";
import { PositionService } from "./position.service";
import { ResumeController } from "./resume.controller";
import { ResumeService } from "./resume.service";

@Module({
  controllers: [HealthController, PositionController, InterviewController, ResumeController],
  providers: [PositionService, InterviewService, ResumeService],
})
export class AppModule {}
