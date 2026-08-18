import { describe, it, expect } from "vitest";
import { PROJECT_IDS, type DataEnvelope } from "./index";

describe("@mt/types", () => {
  it("PROJECT_IDS 包含 8 个子项目且无 gateway", () => {
    expect(PROJECT_IDS).toHaveLength(8);
    expect(PROJECT_IDS).not.toContain("gateway");
    expect(PROJECT_IDS).toContain("applicant");
  });

  it("DataEnvelope 携带 outbox 所需字段", () => {
    const env: DataEnvelope<{ ok: boolean }> = {
      id: "e-1",
      event: "test.happened",
      source: "applicant",
      payload: { ok: true },
      occurredAt: new Date().toISOString(),
    };
    expect(env.source).toBe("applicant");
    expect(env.payload.ok).toBe(true);
  });
});
