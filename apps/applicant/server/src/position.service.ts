import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { POSITION_STATUSES, createPosition, getPosition, listPositions, updatePosition, type PositionInput } from "./position.repo";

@Injectable()
export class PositionService {
  async list(status?: string) {
    return listPositions(status);
  }

  async get(id: string) {
    const row = await getPosition(id);
    if (!row) throw new NotFoundException("岗位不存在");
    return row;
  }

  async create(input: PositionInput) {
    if (input.status && !(POSITION_STATUSES as readonly string[]).includes(input.status)) {
      throw new BadRequestException("非法状态: " + input.status);
    }
    return createPosition(input);
  }

  async update(id: string, patch: Partial<PositionInput>) {
    if (patch.status && !(POSITION_STATUSES as readonly string[]).includes(patch.status)) {
      throw new BadRequestException("非法状态: " + patch.status);
    }
    const row = await updatePosition(id, patch);
    if (!row) throw new NotFoundException("岗位不存在");
    return row;
  }
}
