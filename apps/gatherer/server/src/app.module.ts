import { Module } from "@nestjs/common";
import { CollectService } from "./collect.service";
import { HealthController } from "./health.controller";
import { SourceController } from "./source.controller";
import { SourceService } from "./source.service";

@Module({
  controllers: [HealthController, SourceController],
  providers: [SourceService, CollectService],
})
export class AppModule {}
