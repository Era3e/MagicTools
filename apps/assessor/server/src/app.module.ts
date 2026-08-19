import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { RequestController } from "./request.controller";
import { RequestService } from "./request.service";

@Module({
  controllers: [HealthController, RequestController],
  providers: [RequestService],
})
export class AppModule {}
