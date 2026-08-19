import { Body, Controller, Get, Inject, Param, Patch, Post, Query, BadRequestException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { PositionService, generateGreeting, parseJd, parsePositionImage } from "./position.service";
import type { PositionInput } from "./position.repo";

@Controller("positions")
export class PositionController {
  constructor(@Inject(PositionService) private readonly service: PositionService) {}

  @Post("parse-jd")
  parseJd(@Body() body: { text: string }) {
    if (!body.text || body.text.trim().length < 10) {
      throw new BadRequestException("JD 文本过短");
    }
    return parseJd(body.text);
  }

  @Post(":id/greeting")
  greeting(@Param("id") id: string) {
    return generateGreeting(id);
  }

  @Post("parse-image")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  parseImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("缺少图片文件");
    const ext = (file.originalname.split(".").pop() || "png").toLowerCase();
    const dataUrl = "data:image/" + (ext === "jpg" ? "jpeg" : ext) + ";base64," + file.buffer.toString("base64");
    return parsePositionImage(dataUrl);
  }

  @Get()
  list(@Query("status") status?: string) {
    return this.service.list(status);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() input: PositionInput) {
    return this.service.create(input);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() patch: Partial<PositionInput>) {
    return this.service.update(id, patch);
  }
}
