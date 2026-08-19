import { Module } from "@nestjs/common";
import { EntryController } from "./entry.controller";
import { EntryService } from "./entry.service";
import { HealthController } from "./health.controller";
import { InboxController } from "./inbox.controller";
import { InboxService } from "./inbox.service";

@Module({
  controllers: [HealthController, EntryController, InboxController],
  providers: [EntryService, InboxService],
})
export class AppModule {}
