import { Controller, Inject, Post } from "@nestjs/common";
import { InboxService } from "./inbox.service";

@Controller()
export class InboxController {
  constructor(@Inject(InboxService) private readonly service: InboxService) {}

  @Post("inbox/poll")
  poll() {
    return this.service.poll();
  }
}
