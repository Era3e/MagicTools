import { Controller, Delete, Get, Inject, Param } from "@nestjs/common";
import { FeedbackService } from "./feedback.service";

@Controller()
export class FeedbackController {
  constructor(@Inject(FeedbackService) private readonly service: FeedbackService) {}

  @Get("feedback")
  list() {
    return this.service.list();
  }

  @Delete("feedback/:id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
