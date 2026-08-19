import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { PositionService } from "./position.service";
import type { PositionInput } from "./position.repo";

@Controller("positions")
export class PositionController {
  constructor(@Inject(PositionService) private readonly service: PositionService) {}

  @Get()
  list(@Query("status") status?: string) {
    return this.service.list(status);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() input: PositionInput) {
    return this.service.create(input);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() patch: Partial<PositionInput>) {
    return this.service.update(id, patch);
  }
}
