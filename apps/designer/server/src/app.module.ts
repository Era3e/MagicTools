import { Module } from "@nestjs/common";
import { GenerateController } from "./generate.controller";
import { GenerateService } from "./generate.service";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController, GenerateController],
  providers: [GenerateService],
})
export class AppModule {}
