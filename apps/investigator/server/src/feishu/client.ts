interface FeishuConfig {
  appId?: string;
  appSecret?: string;
  baseUrl?: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

function normalizeValue(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  if (typeof v === "string") return [v];
  if (typeof v === "number") return [String(v)];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.text === "string") return [o.text];
    if (typeof o.name === "string") return [o.name];
    return [JSON.stringify(o)];
  }
  return [String(v)];
}

export class FeishuClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly baseUrl: string;
  private tokenCache: TokenCache | null = null;
  private stub = false;

  constructor(config: FeishuConfig = {}) {
    this.appId = config.appId ?? process.env.FEISHU_APP_ID ?? "";
    this.appSecret = config.appSecret ?? process.env.FEISHU_APP_SECRET ?? "";
    this.baseUrl = (config.baseUrl ?? "https://open.feishu.cn").replace(/\/+$/, "");
    if (process.env.FEISHU_STUB === "1") this.stub = true;
  }

  setStub(value: boolean) {
    this.stub = value;
  }

  isConfigured(): boolean {
    return this.stub || (this.appId.length > 0 && this.appSecret.length > 0);
  }

  private async getTenantToken(): Promise<string> {
    if (this.stub) return "stub-token";
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 5 * 60 * 1000) {
      return this.tokenCache.token;
    }
    const response = await fetch(this.baseUrl + "/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
    });
    const body = (await response.json()) as { code: number; msg?: string; tenant_access_token?: string; expire?: number };
    if (body.code !== 0 || !body.tenant_access_token) {
      throw new Error("获取 tenant_access_token 失败: " + (body.msg || body.code));
    }
    this.tokenCache = { token: body.tenant_access_token, expiresAt: Date.now() + (body.expire ?? 7200) * 1000 };
    return body.tenant_access_token;
  }

  private async request<T>(path: string): Promise<T> {
    const token = await this.getTenantToken();
    const response = await fetch(this.baseUrl + path, {
      headers: { Authorization: "Bearer " + token },
    });
    const body = (await response.json()) as { code: number; msg?: string; data?: T };
    if (!response.ok) throw new Error("HTTP " + response.status);
    if (body.code !== 0) throw new Error("飞书错误 " + body.code + ": " + (body.msg ?? ""));
    return body.data as T;
  }

  async listTables(appToken: string): Promise<Array<{ tableId: string; name: string }>> {
    if (this.stub) return [{ tableId: "tblstub", name: "示例表" }];
    const data = await this.request<{ items?: Array<{ table_id: string; name: string }> }>(
      "/open-apis/bitable/v1/apps/" + appToken + "/tables?page_size=100"
    );
    return (data.items ?? []).map((t) => ({ tableId: t.table_id, name: t.name }));
  }

  async listFields(appToken: string, tableId: string): Promise<string[]> {
    if (this.stub) return ["问题", "回答"];
    const data = await this.request<{ items?: Array<{ field_name: string }> }>(
      "/open-apis/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/fields?page_size=100"
    );
    return (data.items ?? []).map((f) => f.field_name);
  }

  async listRecords(appToken: string, tableId: string): Promise<Array<{ recordId: string; fields: Record<string, string[]> }>> {
    if (this.stub) {
      return [
        { recordId: "recstub1", fields: { 问题: ["你觉得现在最大的痛点是什么"], 回答: ["报表导出太慢，每天要等半小时"] } },
        { recordId: "recstub2", fields: { 问题: ["你最希望改进什么"], 回答: ["希望支持批量操作和模板"] } },
      ];
    }
    const records: Array<{ recordId: string; fields: Record<string, string[]> }> = [];
    let pageToken: string | undefined;
    do {
      const path =
        "/open-apis/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records?page_size=500" + (pageToken ? "&page_token=" + encodeURIComponent(pageToken) : "");
      const data = await this.request<{ has_more?: boolean; page_token?: string; items?: Array<{ record_id: string; fields: Record<string, unknown> }> }>(path);
      for (const item of data.items ?? []) {
        const fields: Record<string, string[]> = {};
        for (const [key, value] of Object.entries(item.fields ?? {})) {
          fields[key] = normalizeValue(value);
        }
        records.push({ recordId: item.record_id, fields });
      }
      pageToken = data.has_more ? data.page_token : undefined;
      await new Promise((resolve) => setTimeout(resolve, 100)); // 限流 20 次/秒
    } while (pageToken);
    return records;
  }
}
