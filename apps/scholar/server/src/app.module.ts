import { Module } from "@nestjs/common";
import { EntryController } from "./entry.controller";
import { EntryService } from "./entry.service";
import { HealthController } from "./health.controller";
import { InboxController } from "./inbox.controller";
import { InboxService } from "./inbox.service";
import { ObsidianController } from "./obsidian.controller";
import { ObsidianService } from "./obsidian.service";
import { SearchService } from "./search.service";

@Module({
  controllers: [HealthController, EntryController, InboxController, ObsidianController],
  providers: [EntryService, InboxService, SearchService, ObsidianService],
})
export class AppModule {}
