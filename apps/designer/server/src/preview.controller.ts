import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { PreviewService } from "./preview.service";

@Controller()
export class PreviewController {
  constructor(@Inject(PreviewService) private readonly service: PreviewService) {}

  @Post("preview")
  preview(@Body() body: { code?: string }) {
    if (!body?.code) throw new BadRequestException("code 必填");
    return this.service.preview(body.code);
  }

  @Get("preview/:id")
  get(@Param("id") id: string, @Res() res: Response) {
    const html = this.service.get(id);
    res.type("html").send(html);
  }
}
