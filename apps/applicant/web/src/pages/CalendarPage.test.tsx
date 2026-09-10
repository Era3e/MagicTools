import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CalendarPage from "./CalendarPage";
import { buildTimeline, computeKpi, buildFollowUps, monthMatrix, cnNum } from "./calendar-view";
import type { InterviewWithPosition, Position } from "../api";

const TODAY = "2026-09-10";

function makePosition(overrides: Partial<Position>): Position {
  return {
    id: "p-" + Math.random().toString(36).slice(2, 8),
    company: "测试公司",
    title: "工程师",
    city: "",
    salary: "",
    source: "manual",
    status: "applied",
    jdRaw: "",
    notes: "",
    updatedAt: "2026-09-10T00:00:00Z",
    appliedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function makeInterview(positionId: string, overrides: Partial<InterviewWithPosition> = {}): InterviewWithPosition {
  return {
    id: "i-" + Math.random().toString(36).slice(2, 8),
    positionId,
    round: 1,
    happenedAt: "2026-09-15T10:00:00Z",
    qaNotes: "",
    reflection: "",
    analysis: null,
    status: "scheduled",
    company: "测试公司",
    title: "工程师",
    positionStatus: "interview",
    ...overrides,
  };
}

describe("calendar-view 纯函数", () => {
  it("时间线：未来在前升序、过去按距今近优先倒序，三类事件齐全", () => {
    const pos = makePosition({ appliedAt: "2026-09-01T00:00:00Z" });
    const ivs = [
      makeInterview(pos.id, { happenedAt: "2026-09-15T10:00:00Z" }),
      makeInterview(pos.id, { status: "done", happenedAt: "2026-09-05T10:00:00Z" }),
    ];
    const nodes = buildTimeline([pos], ivs, TODAY);
    expect(nodes.map((n) => n.kind)).toEqual(["scheduled", "interviewed", "applied"]);
    expect(nodes[0].dday).toBe(5);
    expect(nodes[1].dday).toBe(-5);
    expect(nodes[2].dday).toBe(-9);
  });

  it("KPI：在投/面试流程中/未来7天/待跟进/窗口天数/本月已了结", () => {
    const positions = [
      makePosition({ id: "a", status: "applied", appliedAt: "2026-09-01T00:00:00Z" }),
      makePosition({ id: "b", status: "interview", appliedAt: "2026-09-08T00:00:00Z" }),
      makePosition({ id: "c", status: "waiting", appliedAt: null }),
    ];
    const kpi = computeKpi(positions, [makeInterview("b")], TODAY);
    expect(kpi).toEqual({ active: 2, inInterview: 1, upcoming7d: 1, followUp: 1, windowDays: 5, closedThisMonth: 0 });
  });

  it("待跟进：超7天、applied、无面试记录", () => {
    const stale = makePosition({ id: "s", appliedAt: "2026-08-25T00:00:00Z" });
    const fresh = makePosition({ id: "f", appliedAt: "2026-09-09T00:00:00Z" });
    const withInterview = makePosition({ id: "w", appliedAt: "2026-08-25T00:00:00Z" });
    const items = buildFollowUps([stale, fresh, withInterview], [makeInterview("w")], TODAY);
    expect(items.map((i) => i.position.id)).toEqual(["s"]);
    expect(items[0].days).toBeGreaterThanOrEqual(15);
  });

  it("月格矩阵：周一起始、月首补位、行完整", () => {
    const cells = monthMatrix(2026, 8);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe("2026-09-01");
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(Boolean).length).toBe(30);
  });

  it("中文数字：15 → 十五、3 → 三", () => {
    expect(cnNum(15)).toBe("十五");
    expect(cnNum(3)).toBe("三");
  });
});

describe("CalendarPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("空数据展示空态引导", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );
    expect(await screen.findByText("还没有可展示的动态")).toBeTruthy();
  });

  it("渲染报头与 KPI 读数带", async () => {
    const pos = [makePosition({ company: "读数公司", appliedAt: "2026-09-08T00:00:00Z" })];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        new Response(JSON.stringify(String(url).includes("/interviews") ? [] : pos), { status: 200 })
      )
    );
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );
    expect(await screen.findByText("投递读数")).toBeTruthy();
    expect(screen.getByText("跟踪岗位")).toBeTruthy();
    expect(screen.getByText("七日内节点")).toBeTruthy();
    expect(screen.getByText("本月已了结")).toBeTruthy();
  });
});
