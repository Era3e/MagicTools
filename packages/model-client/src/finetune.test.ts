import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFinetuneClient } from "./finetune";

const BASE = "https://open.bigmodel.cn/api/paas/v4";
const KEY = "test-key";

describe("createFinetuneClient（智谱微调 API）", () => {
  beforeEach(() => {
    delete process.env.FT_STUB;
    delete process.env.FT_STUB_STATUS;
  });
  afterEach(() => {
    delete process.env.FT_STUB;
    delete process.env.FT_STUB_STATUS;
    vi.unstubAllGlobals();
  });

  describe("FT_STUB 桩模式", () => {
    it("uploadFile/createJob 返回 stub id；getJob 默认 running，FT_STUB_STATUS 可控；listEvents 两条", async () => {
      process.env.FT_STUB = "1";
      const c = createFinetuneClient();
      const file = await c.uploadFile(KEY, "dataset.jsonl", "{}\n{}\n");
      expect(file.id).toMatch(/^file-stub-/);

      const job = await c.createJob(KEY, { model: "glm-4-flash", trainingFileId: file.id });
      expect(job.id).toMatch(/^ftjob-stub-/);

      const got = await c.getJob(KEY, job.id);
      expect(got.status).toBe("running");

      process.env.FT_STUB_STATUS = "succeeded";
      const done = await c.getJob(KEY, job.id);
      expect(done.status).toBe("succeeded");
      expect(done.fineTunedModel).toBeTruthy();

      const events = await c.listEvents(KEY, job.id);
      expect(events).toHaveLength(2);
      expect(events[0].id).toBeTruthy();
    });
  });

  describe("真实接口形态（fetch stub）", () => {
    it("uploadFile 走 POST /files multipart，带 Authorization", async () => {
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "file-abc", filename: "d.jsonl", purpose: "fine-tune" }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const c = createFinetuneClient(BASE);
      const res = await c.uploadFile(KEY, "dataset.jsonl", '{"messages":[]}\n');
      expect(res.id).toBe("file-abc");
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe(BASE + "/files");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer " + KEY);
      expect(init.body).toBeInstanceOf(FormData);
      const fd = init.body as FormData;
      expect(fd.get("purpose")).toBe("fine-tune");
    });

    it("createJob 走 POST /fine-tuning/jobs，body 含 model/training_file/fineTuningType", async () => {
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "job-1", status: "created" }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const c = createFinetuneClient(BASE);
      const res = await c.createJob(KEY, { model: "glm-4-flash", trainingFileId: "file-abc" });
      expect(res.id).toBe("job-1");
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe(BASE + "/fine-tuning/jobs");
      const body = JSON.parse(String(init.body));
      expect(body.model).toBe("glm-4-flash");
      expect(body.training_file).toBe("file-abc");
      expect(body.fineTuningType).toBe("sft");
    });

    it("getJob / listEvents 走 GET；字段映射", async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (String(url).includes("/events")) {
          return new Response(JSON.stringify({ data: [{ id: "ev1", type: "TRAIN_PROGRESS", message: "epoch 1" }], has_more: false }), { status: 200 });
        }
        return new Response(JSON.stringify({ id: "job-1", status: "succeeded", fine_tuned_model: "ftglm-abc" }), { status: 200 });
      });
      vi.stubGlobal("fetch", fetchMock);
      const c = createFinetuneClient(BASE);
      const job = await c.getJob(KEY, "job-1");
      expect(job.fineTunedModel).toBe("ftglm-abc");
      const events = await c.listEvents(KEY, "job-1");
      expect(events[0].message).toBe("epoch 1");
    });

    it("非 2xx 抛错含 status", async () => {
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "denied" }), { status: 403 }));
      vi.stubGlobal("fetch", fetchMock);
      const c = createFinetuneClient(BASE);
      await expect(c.getJob(KEY, "job-1")).rejects.toThrow(/403/);
    });
  });
});
