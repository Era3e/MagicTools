import { Controller, Get, Inject } from "@nestjs/common";
import { CybercloudService } from "./cybercloud.service";
import { listCybercloudCalls } from "./cybercloud-calls.repo";

@Controller()
export class MetaController {
  constructor(@Inject(CybercloudService) private readonly service: CybercloudService) {}

  @Get("meta/data-source-status")
  async status() {
    return { ...this.service.status(), probe: await this.service.probe() };
  }

  @Get("meta/cybercloud-calls")
  calls() {
    return listCybercloudCalls(200);
  }
}
