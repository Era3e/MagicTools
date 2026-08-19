import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PositionController } from "./position.controller";
import { PositionService } from "./position.service";

@Module({
  controllers: [HealthController, PositionController],
  providers: [PositionService],
})
export class AppModule {}
