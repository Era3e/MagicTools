import { describe, it, expect } from "vitest";
import { buildRoutes, serviceHost } from "./routes";

describe("gateway routes", () => {
  it("按 ports 配置生成 web 与 api 两条路由", () => {
    const routes = buildRoutes({ applicant: { web: 4008, server: 5008 } }, () => "127.0.0.1");
    expect(routes).toEqual([
      { name: "applicant-web", path: "/applicant", target: "http://127.0.0.1:4008" },
      { name: "applicant-server", path: "/api/applicant", target: "http://127.0.0.1:5008" },
    ]);
  });

  it("生产环境目标主机使用容器服务名", () => {
    const host = serviceHost({ MT_PROD: "1" });
    expect(host("applicant-server")).toBe("applicant-server");
  });

  it("本地环境目标主机使用 127.0.0.1", () => {
    const host = serviceHost({});
    expect(host("applicant-server")).toBe("127.0.0.1");
  });
});
