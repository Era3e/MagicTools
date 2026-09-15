import { Module } from "@nestjs/common";
import { EntryController } from "./entry.controller";
import { EntryService } from "./entry.service";
import { GraphController } from "./graph.controller";
import { GraphService } from "./graph.service";
import { HealthController } from "./health.controller";
import { InboxController } from "./inbox.controller";
import { InboxService } from "./inbox.service";
import { KnowledgeSpaceController } from "./knowledge-space.controller";
import { KnowledgeSpaceService } from "./knowledge-space.service";
import { ObsidianController } from "./obsidian.controller";
import { ObsidianService } from "./obsidian.service";
import { SearchService } from "./search.service";

@Module({
  controllers: [HealthController, EntryController, KnowledgeSpaceController, InboxController, ObsidianController, GraphController],
  providers: [EntryService, InboxService, KnowledgeSpaceService, SearchService, ObsidianService, GraphService],
})
export class AppModule {}
