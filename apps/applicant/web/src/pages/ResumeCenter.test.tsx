import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResumeCenter from "./ResumeCenter";

afterEach(() => vi.unstubAllGlobals());

describe("ResumeCenter", () => {
  it("渲染简历列表与未配置额度提示", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        if (u.includes("/meta/quota")) return new Response(JSON.stringify({ configured: false, quota: null }), { status: 200 });
        if (u.includes("/resumes")) return new Response(JSON.stringify([{ id: "r1", name: "我的简历", version: 1, source: "clawcv", contentText: "x", lastAnalysis: null }]), { status: 200 });
        return new Response("[]", { status: 200 });
      })
    );
    render(
      <MemoryRouter>
        <ResumeCenter />
      </MemoryRouter>
    );
    expect(await screen.findByText("我的简历")).toBeTruthy();
    expect(await screen.findByText(/ClawCV 未配置/)).toBeTruthy();
  });
});
