import { Module } from "@nestjs/common";
import { ComponentController } from "./component.controller";
import { ComponentService } from "./component.service";
import { GenerateController } from "./generate.controller";
import { GenerateService } from "./generate.service";
import { HealthController } from "./health.controller";
import { ParseController } from "./parse.controller";
import { ParseService } from "./parse.service";
import { PreviewController } from "./preview.controller";
import { PreviewService } from "./preview.service";
import { PublishController } from "./publish.controller";
import { PublishService } from "./publish.service";

@Module({
  controllers: [HealthController, GenerateController, PreviewController, ComponentController, PublishController, ParseController],
  providers: [GenerateService, PreviewService, ComponentService, PublishService, ParseService],
})
export class AppModule {}
