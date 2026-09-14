import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { RepositoryEvidenceService } from "./repository-evidence.service";

const reverseEngineerSchema = z.object({
  repo: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  commitSha: z.string().regex(/^[0-9a-f]{7,40}$/i),
});

@Controller("repository-evidence")
export class RepositoryEvidenceController {
  constructor(@Inject(RepositoryEvidenceService) private readonly service: RepositoryEvidenceService) {}

  @Post("reverse-engineer")
  reverseEngineer(@Body() body: unknown) {
    const parsed = reverseEngineerSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("仓库证据采集参数非法");
    return this.service.reverseEngineer(parsed.data);
  }

  @Get("tasks")
  list(@Query("limit") limit?: string) {
    const parsed = limit === undefined ? undefined : Number(limit);
    if (parsed !== undefined && (!Number.isInteger(parsed) || parsed < 1 || parsed > 100)) {
      throw new BadRequestException("limit必须为1-100的整数");
    }
    return this.service.list(parsed);
  }

  @Get("tasks/:id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }
}
