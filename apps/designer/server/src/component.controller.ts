import { Body, Controller, Delete, Get, Inject, Param, Post } from "@nestjs/common";
import { ComponentService } from "./component.service";

@Controller()
export class ComponentController {
  constructor(@Inject(ComponentService) private readonly service: ComponentService) {}

  @Post("components")
  add(@Body() body: unknown) {
    return this.service.add(body);
  }

  @Get("components")
  list() {
    return this.service.list();
  }

  @Get("components/:id/code")
  code(@Param("id") id: string) {
    return this.service.code(id);
  }

  @Delete("components/:id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
