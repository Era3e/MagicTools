import type { APIRequestContext } from "@playwright/test";

export const MANAGER_SAMPLE_TITLE = "P14 样板：真实页面与稳定业务数据";
export const SCHOLAR_SAMPLE_TITLE = "MagicTools 用户帮助：发布与验证流程";
export const ASSISTANT_SAMPLE_QUESTION = "MagicTools 发布流程和用户帮助要点是什么";
export const SAMPLE_CATEGORY = "P14 页面样板";

export const sampleRoutes: { managerDetail: string; assistantConversation: string } = {
  managerDetail: "/manager/requirements",
  assistantConversation: "/assistant/chat",
};

async function json(request: APIRequestContext, url: string, init?: Parameters<APIRequestContext["get"]>[1]) {
  const response = await request.get(url, init);
  if (!response.ok()) throw new Error("GET " + url + " failed: " + response.status());
  return response.json();
}

async function post<T>(request: APIRequestContext, url: string, data: unknown): Promise<T> {
  const response = await request.post(url, { data });
  if (!response.ok()) throw new Error("POST " + url + " failed: " + response.status() + " " + await response.text());
  return response.json() as Promise<T>;
}

async function patch<T>(request: APIRequestContext, url: string, data: unknown): Promise<T> {
  const response = await request.patch(url, { data });
  if (!response.ok()) throw new Error("PATCH " + url + " failed: " + response.status() + " " + await response.text());
  return response.json() as Promise<T>;
}

export async function seedBusinessSamples(request: APIRequestContext) {
  const scholarEntries = await json(request, "/api/scholar/entries?category=" + encodeURIComponent(SAMPLE_CATEGORY));
  let scholar = scholarEntries.find((entry: { title: string }) => entry.title === SCHOLAR_SAMPLE_TITLE);
  if (!scholar) {
    scholar = await post<{ id: string }>(request, "/api/scholar/entries", {
      title: SCHOLAR_SAMPLE_TITLE,
      content: "发布前确认变更范围、验收命令和回退方案；发布中固定制品摘要并记录回执；发布后回读健康、数据和关键用户路径。失败时保留现场与证据，先恢复服务再定位。用户帮助按目标、入口、前置条件、操作、校验和异常组织，不把内部实现细节暴露给普通用户。",
      summary: "覆盖发布准备、验证、回读、回退与用户帮助写作口径。",
      category: SAMPLE_CATEGORY,
      tags: ["用户帮助", "发布流程", "P14"],
      spaceKey: "product",
      sourceRevision: "e2e-p14-business-sample",
    });
    await patch(request, "/api/scholar/entries/" + scholar.id, { assistantScope: true });
  } else if (scholar.spaceKey !== "product" || !scholar.assistantScope) {
    await patch(request, "/api/scholar/entries/" + scholar.id, {
      assistantScope: true,
      spaceKey: "product",
    });
  }

  const publicVersionResponse = await request.get("/api/scholar/public/version/current");
  let publishedSample = false;
  if (publicVersionResponse.ok()) {
    const publicEntries = await json(request, "/api/scholar/public/entries");
    publishedSample = publicEntries.some((entry: { id: string }) => entry.id === scholar.id);
  }
  if (!publishedSample) {
    const version = await post<{ id: string }>(request, "/api/scholar/spaces/product/versions", {
      version: "p14-samples-" + Date.now(),
      sourceRevision: "e2e-p14-business-sample",
    });
    await post(request, "/api/scholar/versions/" + version.id + "/publish", {
      entryIds: [scholar.id],
      deploymentRef: "e2e-p14-business-samples",
      publishedBy: "e2e-visual",
    });
  }

  const requirements = await json(request, "/api/manager/requirements");
  let requirement = requirements.find((item: { title: string }) => item.title === MANAGER_SAMPLE_TITLE);
  if (!requirement) {
    requirement = await post<{ id: string; revision: number }>(request, "/api/manager/requirements", {
      title: MANAGER_SAMPLE_TITLE,
      description: "发布看板、对话与帮助目录三类真实页面样板。每类页面使用固定业务数据，核心区域进入视觉与键盘回归，不再依赖空库或整块遮罩。",
      priority: "P1",
      project: "manager",
      scope: "Manager 详情、Assistant 长对话、Scholar 帮助目录与对应 E2E。",
      risk: "low",
      acceptanceCriteria: [
        "固定业务数据的看板、详情、长答案和帮助目录有截图基线",
        "核心业务文案不可见时视觉验证失败",
        "样板页面主要动作可键盘操作",
      ],
    });
  }

  if (requirement.status !== "developing") {
    if (requirement.status === "done") throw new Error("P14 样板需求已被移动到 done，不能自动改回开发中");
    const nextStatuses: Record<string, string> = {
      waiting: "designing",
      designing: "todo",
      todo: "developing",
      developing: "",
      testing: "developing",
      accepting: "testing",
    };
    let cursor: { status: string; revision: number } = requirement;
    while (cursor.status !== "developing") {
      const next = nextStatuses[cursor.status];
      if (!next) throw new Error("P14 样板需求状态无法到达 developing：" + cursor.status);
      cursor = await patch<{ status: string; revision: number }>(request, "/api/manager/requirements/" + requirement.id, {
        status: next,
        expectedRevision: cursor.revision,
      });
    }
    requirement = await patch(request, "/api/manager/requirements/" + requirement.id, {
      prUrl: "https://github.com/Era3e/MagicTools/pull/83",
      expectedRevision: cursor.revision,
    });
  }

  const conversations = await json(request, "/api/assistant/conversations");
  const conversation = conversations.find((item: { title: string }) => item.title === ASSISTANT_SAMPLE_QUESTION);
  if (!conversation) {
    const answer = await post<{ sessionId: string; reply: string }>(request, "/api/assistant/chat", {
      message: ASSISTANT_SAMPLE_QUESTION,
    });
    if (!answer.reply.includes(SCHOLAR_SAMPLE_TITLE)) {
      throw new Error("Assistant 样板回答未引用 Scholar 固定内容：" + answer.reply);
    }
    sampleRoutes.assistantConversation = "/assistant/chat?conversation=" + answer.sessionId;
  } else {
    sampleRoutes.assistantConversation = "/assistant/chat?conversation=" + conversation.id;
  }

  sampleRoutes.managerDetail = "/manager/requirements/" + requirement.id;
  return sampleRoutes;
}
