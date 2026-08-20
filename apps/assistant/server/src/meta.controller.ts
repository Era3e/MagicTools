import { Controller, Get, Inject } from "@nestjs/common";
import { CybercloudService } from "./cybercloud.service";

@Controller()
export class MetaController {
  constructor(@Inject(CybercloudService) private readonly service: CybercloudService) {}

  @Get("meta/data-source-status")
  status() {
    return this.service.status();
  }
}
