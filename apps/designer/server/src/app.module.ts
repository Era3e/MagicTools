import { Module } from "@nestjs/common";
import { ComponentController } from "./component.controller";
import { ComponentService } from "./component.service";
import { GenerateController } from "./generate.controller";
import { GenerateService } from "./generate.service";
import { HealthController } from "./health.controller";
import { PreviewController } from "./preview.controller";
import { PreviewService } from "./preview.service";

@Module({
  controllers: [HealthController, GenerateController, PreviewController, ComponentController],
  providers: [GenerateService, PreviewService, ComponentService],
})
export class AppModule {}
