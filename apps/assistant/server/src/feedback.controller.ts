import { Controller, Delete, Get, Inject, Param, Req } from "@nestjs/common";
import { assertAdmin, type AdminRequest } from "./admin-auth";
import { FeedbackService } from "./feedback.service";

@Controller()
export class FeedbackController {
  constructor(@Inject(FeedbackService) private readonly service: FeedbackService) {}

  @Get("feedback")
  list(@Req() request: AdminRequest) {
    assertAdmin(request);
    return this.service.list();
  }

  @Delete("feedback/:id")
  remove(@Param("id") id: string, @Req() request: AdminRequest) {
    assertAdmin(request);
    return this.service.remove(id);
  }
}
