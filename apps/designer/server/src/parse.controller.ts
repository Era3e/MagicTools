import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { ParseService } from "./parse.service";

@Controller()
export class ParseController {
  constructor(@Inject(ParseService) private readonly service: ParseService) {}

  @Post("parse")
  @HttpCode(200)
  parse(@Body() body: unknown) {
    return this.service.parse(body);
  }
}
