import { Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "./admin-auth";
import { InboxService } from "./inbox.service";

@Controller()
@UseGuards(AdminGuard)
export class InboxController {
  constructor(@Inject(InboxService) private readonly service: InboxService) {}

  @Post("inbox/poll")
  poll() {
    return this.service.poll();
  }
}
