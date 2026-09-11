import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ImportService } from "./import.service";

@Controller("import-batches")
export class ImportController {
  constructor(@Inject(ImportService) private readonly service: ImportService) {}

  @Post("preview")
  preview(@Body() body: unknown) { return this.service.preview(body); }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) { return this.service.get(id); }

  @Post(":id/confirm")
  confirm(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.confirm(id, body); }

  @Post(":id/remaining-preview")
  remaining(@Param("id", ParseUUIDPipe) id: string) { return this.service.remainingPreview(id); }
}

@Controller("capabilities")
export class CapabilityController {
  constructor(@Inject(ImportService) private readonly service: ImportService) {}
  @Get()
  list() { return this.service.capabilities(); }
}
