import { Body, Controller, Get, Inject, Param, Patch, Post, Query, BadRequestException } from "@nestjs/common";
import { PositionService, generateGreeting, parseJd } from "./position.service";
import type { PositionInput } from "./position.repo";

@Controller("positions")
export class PositionController {
  constructor(@Inject(PositionService) private readonly service: PositionService) {}

  @Post("parse-jd")
  parseJd(@Body() body: { text: string }) {
    if (!body.text || body.text.trim().length < 10) {
      throw new BadRequestException("JD 文本过短");
    }
    return parseJd(body.text);
  }

  @Post(":id/greeting")
  greeting(@Param("id") id: string) {
    return generateGreeting(id);
  }

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
