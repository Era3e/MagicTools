import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { GenerateService } from "./generate.service";

@Controller()
export class GenerateController {
  constructor(@Inject(GenerateService) private readonly service: GenerateService) {}

  @Post("generate")
  generate(@Body() body: unknown) {
    return this.service.generate(body);
  }

  @Get("generations")
  list() {
    return this.service.list();
  }
}
