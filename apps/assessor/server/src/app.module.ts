import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { RequestController } from "./request.controller";
import { RequestService } from "./request.service";
import { RepositoryEvidenceController } from "./repository-evidence.controller";
import { RepositoryEvidenceService } from "./repository-evidence.service";

@Module({
  controllers: [HealthController, RequestController, RepositoryEvidenceController],
  providers: [RequestService, RepositoryEvidenceService],
})
export class AppModule {}
