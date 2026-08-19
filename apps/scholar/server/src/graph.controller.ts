import { Controller, Get, Inject, Post } from "@nestjs/common";
import { GraphService } from "./graph.service";

@Controller()
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
