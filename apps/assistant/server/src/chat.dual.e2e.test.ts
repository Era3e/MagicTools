import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate } from "./db";

let available = false;
let app: INestApplication | null = null;

beforeAll(async () => {
  try {
    process.env.MT_LLM_STUB = "1";
    process.env.CYBERCLOUD_STUB = "1";
    await ensureDatabase();
    await migrate();
    available = true;
  } catch (err) {
    console.warn("[chat.dual.e2e] 数据库不可用，跳过: " + String(err));
    available = false;
  }
}, 30000);

afterAll(async () => {
  if (app) await app.close();
});

async function appFor(): Promise<INestApplication> {
  const { Test } = await import("@nestjs/testing");
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const instance = moduleRef.createNestApplication();
  instance.setGlobalPrefix("api/assistant");
  await instance.init();
  return instance;
}

interface VerifyBody {
  status: string;
  verdict?: { directValue: number; agentNumbers: number[]; diffPct?: number };
  agentReply?: string;
}

async function waitTerminal(server: unknown, taskId: string): Promise<VerifyBody> {
  for (let i = 0; i < 50; i++) {
    const res = await request(server as never).get("/api/assistant/chat/verify/" + taskId);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200 && res.body.status !== "pending") return res.body as VerifyBody;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("verify 任务未终态");
}

async function runScenario(agentAnswer: string | undefined, expected: string): Promise<void> {
  if (agentAnswer !== undefined) process.env.CYBERCLOUD_STUB_AGENT_ANSWER = agentAnswer;
  app = await appFor();
  try {
    const chat = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "查询本月销售额多少" });
    expect(chat.status).toBe(201);
    expect(chat.body.intent).toBe("data_query");
    expect(chat.body.reply).toContain("12345");
    expect(chat.body.verify.taskId).toBeTruthy();
    expect(chat.body.dataSource.mode).toBe("dual");
    const verify = await waitTerminal(app.getHttpServer(), chat.body.verify.taskId);
    expect(verify.status).toBe(expected);
    if (expected === "divergent") {
      expect(verify.verdict?.directValue).toBe(12345);
      expect(verify.agentReply).toContain("99999");
    }
  } finally {
    await app.close();
    app = null;
    delete process.env.CYBERCLOUD_STUB_AGENT_ANSWER;
  }
}

describe("chat 双路编排 e2e", () => {
  it("桩场景 consistent：智能体回答一致", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }
    await runScenario(undefined, "consistent");
  }, 30000);

  it("桩场景 divergent：智能体数值分歧", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }
    await runScenario("其实是 99999 元", "divergent");
  }, 30000);

  it("桩场景 agent_failed：智能体故障", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }
    await runScenario("__FAIL__", "agent_failed");
  }, 30000);
});
