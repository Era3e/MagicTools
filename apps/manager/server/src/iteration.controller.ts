import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { IterationService } from "./iteration.service";

@Controller("iterations")
export class IterationController {
  constructor(@Inject(IterationService) private readonly service: IterationService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() body: { name: string; startDate?: string | null; endDate?: string | null }) {
    return this.service.create(body);
  }
}
