import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { SurveyController } from "./survey.controller";
import { SurveyService } from "./survey.service";

@Module({
  controllers: [HealthController, SurveyController],
  providers: [SurveyService],
})
export class AppModule {}
