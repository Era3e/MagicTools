import { Controller, Param, Post } from "@nestjs/common";
import { PublishService, type PublishResult } from "./publish.service";

@Controller("components")
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  /** 一键 PR 到 @mt/ui */
  @Post(":id/publish")
  async publish(@Param("id") id: string): Promise<PublishResult> {
    return this.publishService.publish(id);
  }
}
