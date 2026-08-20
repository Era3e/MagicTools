import { afterEach, describe, expect, it, vi } from "vitest";
import { IntentService } from "./intent.service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("IntentService", () => {
  it("桩模式判别三意图", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const svc = new IntentService();
    expect(await svc.classify("查询一下这个月的数据")).toBe("data_query");
    expect(await svc.classify("你好")).toBe("chitchat_reject");
    expect(await svc.classify("我们的产品有哪些功能")).toBe("product_inquiry");
  });

  it("多轮历史参与判别（指代消解）", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const svc = new IntentService();
    const intent = await svc.classify("那第二个呢", [
      { role: "user", content: "帮我查一下销售数据" },
      { role: "assistant", content: "这是销售数据……" },
    ]);
    expect(intent).toBe("data_query");
  });

  it("LLM 输出非法 JSON 时回退 product_inquiry", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "不是 JSON" } }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const svc = new IntentService();
    expect(await svc.classify("随便问个问题")).toBe("product_inquiry");
  });
});
