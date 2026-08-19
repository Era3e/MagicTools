import { Injectable, BadRequestException } from "@nestjs/common";
import { createIteration, listIterations } from "./iteration.repo";

@Injectable()
export class IterationService {
  list() {
    return listIterations();
  }

  create(input: { name: string; startDate?: string | null; endDate?: string | null }) {
    if (!input.name?.trim()) throw new BadRequestException("名称必填");
    return createIteration(input);
  }
}
