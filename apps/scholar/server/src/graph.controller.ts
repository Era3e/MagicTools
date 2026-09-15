import { Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "./admin-auth";
import { GraphService } from "./graph.service";

@Controller()
@UseGuards(AdminGuard)
export class GraphController {
  constructor(@Inject(GraphService) private readonly service: GraphService) {}

  @Get("graph")
  get() {
    return this.service.get();
  }

  @Post("graph/generate")
  generate() {
    return this.service.generate();
  }
}
