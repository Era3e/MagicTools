import { Injectable, NotFoundException } from "@nestjs/common";
import { deleteFeedback, insertFeedback, listFeedback } from "./feedback.repo";

const POLITE_REPLY = "收到你的反馈，我们已经记录并会尽快改进，谢谢！";

@Injectable()
export class FeedbackService {
  async collect(content: string): Promise<{ reply: string }> {
    await insertFeedback(content);
    return { reply: POLITE_REPLY };
  }

  list() {
    return listFeedback();
  }

  async remove(id: string) {
    if (!(await deleteFeedback(id))) throw new NotFoundException("反馈不存在");
    return { deleted: true };
  }
}
