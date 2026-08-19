import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PositionList from "./PositionList";

const items = [
  {
    id: "p1",
    company: "测试公司A",
    title: "后端",
    city: "杭州",
    salary: "",
    source: "manual",
    status: "waiting",
    jdRaw: "",
    notes: "",
    updatedAt: "2026-08-19T00:00:00Z",
  },
];

describe("PositionList", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("渲染岗位表格与状态标签", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(items), { status: 200 })));
    render(
      <MemoryRouter>
        <PositionList />
      </MemoryRouter>
    );
    expect(await screen.findByText("测试公司A")).toBeTruthy();
    expect(screen.getByText("待投递")).toBeTruthy();
  });
});
