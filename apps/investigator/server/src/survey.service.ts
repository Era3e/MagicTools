import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { FeishuClient } from "./feishu/client";
import { createSurvey, getSurvey, listSurveys, updateSurvey } from "./survey.repo";

@Injectable()
export class SurveyService {
  list() {
    return listSurveys();
  }

  async get(id: string) {
    const row = await getSurvey(id);
    if (!row) throw new NotFoundException("调研主题不存在");
    return row;
  }

  create(input: { name: string; description?: string; appToken?: string; tableId?: string; answerFields?: string[] }) {
    if (!input.name || input.name.trim().length === 0) throw new BadRequestException("名称必填");
    return createSurvey(input);
  }

  async update(id: string, patch: Parameters<typeof updateSurvey>[1]) {
    if (patch.status && !["active", "archived"].includes(patch.status)) {
      throw new BadRequestException("非法状态: " + patch.status);
    }
    const row = await updateSurvey(id, patch);
    if (!row) throw new NotFoundException("调研主题不存在");
    return row;
  }

  async feishuStatus() {
    const client = new FeishuClient();
    if (process.env.FEISHU_STUB === "1") {
      return { configured: true, stub: true, note: "FEISHU_STUB 桩模式" };
    }
    return { configured: client.isConfigured(), stub: false };
  }
}
