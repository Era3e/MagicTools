import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GeneratePage from "./GeneratePage";

const CODE = 'import { Card } from "antd";\nexport default function GreetingCard() { return <Card>你好</Card>; }';

describe("GeneratePage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.includes("/api/designer/generate") && method === "POST") {
        return new Response(JSON.stringify({ generationId: "g1", componentName: "GreetingCard", description: "问候卡片", code: CODE, status: "ok" }), { status: 201 });
      }
      if (u.includes("/api/designer/preview") && method === "POST") {
        return new Response(JSON.stringify({ ok: true, previewId: "p1" }), { status: 201 });
      }
      if (u.includes("/api/designer/components") && method === "POST") {
        return new Response(JSON.stringify({ component: { id: "c1", name: "GreetingCard" }, duplicated: false }), { status: 201 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("生成组件并展示代码与 iframe 预览", async () => {
    render(<GeneratePage />);
    fireEvent.change(screen.getByPlaceholderText("描述你要生成的组件，例如：一个带统计数字的卡片"), { target: { value: "问候卡片" } });
    fireEvent.click(screen.getByRole("button", { name: /生\s*成/ }));
    expect(await screen.findByText("GreetingCard")).toBeTruthy();
    await waitFor(() => {
      const pre = document.querySelector("pre");
      expect(pre?.textContent).toContain("export default function GreetingCard");
    });
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe!.getAttribute("src")).toContain("/api/designer/preview/p1");
    expect(screen.getByRole("button", { name: /下\s*载/ })).toBeTruthy();
  });

  it("沉淀按钮调用 POST /components", async () => {
    render(<GeneratePage />);
    fireEvent.change(screen.getByPlaceholderText("描述你要生成的组件，例如：一个带统计数字的卡片"), { target: { value: "问候卡片" } });
    fireEvent.click(screen.getByRole("button", { name: /生\s*成/ }));
    fireEvent.click(await screen.findByRole("button", { name: /沉\s*淀/ }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST" && String(c[0]).includes("/api/designer/components"));
      expect(post).toBeTruthy();
      const body = JSON.parse(String((post![1] as RequestInit).body));
      expect(body.name).toBe("GreetingCard");
    });
  });

  it("prompt 为空时不调用生成", async () => {
    render(<GeneratePage />);
    fireEvent.click(screen.getByRole("button", { name: /生\s*成/ }));
    await waitFor(() => {
      const gen = fetchMock.mock.calls.find((c) => String(c[0]).includes("/api/designer/generate"));
      expect(gen).toBeUndefined();
    });
  });
});
