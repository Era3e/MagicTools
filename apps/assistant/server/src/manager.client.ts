import { Injectable } from "@nestjs/common";

const GATEWAY_URL = () => process.env.INTERNAL_GATEWAY_URL ?? (process.env.MT_PROD === "1" ? "http://gateway:3000" : "http://127.0.0.1:3000");

function headers(): Record<string, string> {
  const token = process.env.GATEWAY_ASSISTANT_SERVICE_TOKEN ?? process.env.GATEWAY_TOKEN;
  return { "Content-Type": "application/json", ...(token ? { "x-access-token": token } : {}) };
}

@Injectable()
export class ManagerClient {
  async createBadcaseRequirement(input: {
    badcaseId: string; title: string; description: string; evidence: Record<string, unknown>;
    acceptanceCriteria: string[];
  }): Promise<{ id: string; url: string; status: string; prUrl: string }> {
    const response = await fetch(GATEWAY_URL() + "/api/manager/requirements/assistant-badcases", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((body as { message?: string }).message || "创建 Manager 需求失败 " + response.status);
    return body as { id: string; url: string; status: string; prUrl: string };
  }

  async getRequirement(id: string): Promise<{ id: string; url: string; status: string; prUrl: string } | null> {
    const response = await fetch(GATEWAY_URL() + "/api/manager/requirements/" + id, { headers: headers() });
    if (response.status === 404) return null;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((body as { message?: string }).message || "查询 Manager 需求失败 " + response.status);
    return body as { id: string; url: string; status: string; prUrl: string };
  }
}
