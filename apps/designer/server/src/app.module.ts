import { Module } from "@nestjs/common";
import { GenerateController } from "./generate.controller";
import { GenerateService } from "./generate.service";
import { HealthController } from "./health.controller";
import { PreviewController } from "./preview.controller";
import { PreviewService } from "./preview.service";

@Module({
  controllers: [HealthController, GenerateController, PreviewController],
  providers: [GenerateService, PreviewService],
})
export class AppModule {}
