import { afterEach, describe, expect, it, vi } from "vitest";
import { IntentService } from "./intent.service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("IntentService", () => {
  it("桩模式判别三基础意图", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const svc = new IntentService();
    expect((await svc.classify("查询一下这个月的数据")).intent).toBe("data_query");
    expect((await svc.classify("你好")).intent).toBe("chitchat_reject");
    expect((await svc.classify("我们的产品有哪些功能")).intent).toBe("product_inquiry");
  });

  it("桩模式判别三新意图", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const svc = new IntentService();
    expect((await svc.classify("帮我创建一个需求：支持导出功能")).intent).toBe("process_execution");
    expect((await svc.classify("触发一次信息采集")).intent).toBe("process_execution");
    expect((await svc.classify("系统报错了怎么排查")).intent).toBe("trouble_shooting");
    expect((await svc.classify("服务挂了帮我看看")).intent).toBe("trouble_shooting");
    expect((await svc.classify("我要投诉，功能不好用")).intent).toBe("complaint_feedback");
    expect((await svc.classify("给你一个反馈：界面不错")).intent).toBe("complaint_feedback");
  });

  it("动作类关键词优先于排查类", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const svc = new IntentService();
    expect((await svc.classify("帮我创建一个需求，然后排查失败原因")).intent).toBe("process_execution");
  });

  it("cybercloud 域操作优先路由到 data_query（方案 A）", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const svc = new IntentService();
    expect((await svc.classify("帮我创建一个订单业务对象")).intent).toBe("data_query");
    expect((await svc.classify("在 test 插件下创建一个 Student 对象")).intent).toBe("data_query");
    expect((await svc.classify("给订单对象加一个金额字段")).intent).toBe("data_query");
    expect((await svc.classify("帮我创建一个需求：支持导出功能")).intent).toBe("process_execution");
    expect((await svc.classify("触发一次信息采集")).intent).toBe("process_execution");
  });

  it("多轮历史参与判别（指代消解）", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const svc = new IntentService();
    const route = await svc.classify("那第二个呢", [
      { role: "user", content: "帮我查一下销售数据" },
      { role: "assistant", content: "这是销售数据……" },
    ]);
    expect(route.intent).toBe("data_query");
  });

  it("分层路由返回 domain 与置信度", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const svc = new IntentService();
    const r1 = await svc.classify("帮我创建一个订单业务对象");
    expect(r1.domain).toBe("cybercloud");
    expect(r1.intent).toBe("data_query");
    expect(r1.confidence).toBe(1);
    const r2 = await svc.classify("帮我创建一个需求：支持导出功能");
    expect(r2.domain).toBe("magictools");
    expect(r2.intent).toBe("process_execution");
    const r3 = await svc.classify("你好");
    expect(r3.domain).toBe("chitchat");
    expect(r3.intent).toBe("chitchat_reject");
  });

  it("真实模式 LLM 输出非法 JSON 时回退规则且置信度为 0", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "不是 JSON" } }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const svc = new IntentService();
    const route = await svc.classify("随便问个问题");
    expect(route.intent).toBe("product_inquiry");
    expect(route.confidence).toBe(0);
  });

  it("LLM 输出非法 JSON 时回退 product_inquiry", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "不是 JSON" } }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const svc = new IntentService();
    expect((await svc.classify("随便问个问题")).intent).toBe("product_inquiry");
  });
});