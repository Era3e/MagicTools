import { Module } from "@nestjs/common";
import { EntryController } from "./entry.controller";
import { EntryService } from "./entry.service";
import { HealthController } from "./health.controller";
import { InboxController } from "./inbox.controller";
import { InboxService } from "./inbox.service";
import { SearchService } from "./search.service";

@Module({
  controllers: [HealthController, EntryController, InboxController],
  providers: [EntryService, InboxService, SearchService],
})
export class AppModule {}
