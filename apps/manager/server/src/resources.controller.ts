import { Body, Controller, Get, Headers, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ResourcesService } from "./resources.service";

@Controller("resources")
export class ResourcesController {
  constructor(@Inject(ResourcesService) private readonly service: ResourcesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() body: unknown, @Headers("x-manager-approval-token") token?: string) {
    return this.service.create(body, token);
  }

  @Post(":id/checks")
  addCheck(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Headers("x-manager-approval-token") token?: string,
  ) {
    return this.service.addCheck(id, body, token);
  }
}
