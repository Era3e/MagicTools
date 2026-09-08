import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MagazineList } from "./MagazineList";
import { ControlTable } from "./ControlTable";
import { DetailHero } from "./DetailHero";
import { TimelineBurndown } from "./TimelineBurndown";
import type { BurndownRequirement } from "./TimelineBurndown";

// jsdom 缺失的浏览器 API polyfill（antd Row/Col 依赖 matchMedia，同 apps/*/web test-setup 惯例）
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(cleanup);

describe("patterns · MagazineList", () => {
  it("渲染眉题/标题/副标题/筛选条与卡片栅格", () => {
    render(
      <MagazineList eyebrow="文化 · 第 23 期" title="岗位博览" subtitle="副标题" filterBar={<button>筛选</button>}>
        <div key="a">卡片A</div>
        <div key="b">卡片B</div>
      </MagazineList>
    );
    expect(screen.getByText("文化 · 第 23 期")).toBeTruthy();
    expect(screen.getByText("岗位博览")).toBeTruthy();
    expect(screen.getByText("副标题")).toBeTruthy();
    expect(screen.getByText("卡片A")).toBeTruthy();
    expect(screen.getByText("筛选")).toBeTruthy();
  });

  it("empty 配置时渲染 MtEmptyState 且带操作回调", () => {
    const onAction = vi.fn();
    render(
      <MagazineList title="岗位博览" empty={{ title: "暂无岗位", actionText: "去创建", onAction }} />
    );
    fireEvent.click(screen.getByText("去创建"));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText("EMPTY")).toBeTruthy();
  });
});

describe("patterns · ControlTable", () => {
  it("渲染标题/说明/操作区/筛选条与表格内容", () => {
    render(
      <ControlTable
        title="需求管理"
        description="需求的增删改查"
        actions={<button>新建</button>}
        toolbar={<input placeholder="搜索" />}
      >
        <table>
          <tbody>
            <tr>
              <td>行1</td>
            </tr>
          </tbody>
        </table>
      </ControlTable>
    );
    expect(screen.getByText("需求管理")).toBeTruthy();
    expect(screen.getByText("需求的增删改查")).toBeTruthy();
    expect(screen.getByText("新建")).toBeTruthy();
    expect(screen.getByText("行1")).toBeTruthy();
  });

  it("children 为空且传 empty 时渲染空态", () => {
    render(
      <ControlTable title="列表" empty={{ title: "暂无数据" }} />
    );
    expect(screen.getByText("暂无数据")).toBeTruthy();
    expect(screen.getByText("EMPTY")).toBeTruthy();
  });
});

describe("patterns · DetailHero", () => {
  it("渲染面包屑/标题/徽章/元信息与主次操作", () => {
    render(
      <DetailHero
        breadcrumb={<nav>面包屑</nav>}
        title="需求 · 001"
        badges={<span>DOING</span>}
        metaItems={[
          { label: "状态", value: "开发中" },
          { label: "优先级", value: "P0", tone: "error" },
          { label: "来源", value: "Assessor" },
          { label: "负责人", value: "墨工" },
        ]}
        primaryActions={<button>通过</button>}
        secondaryActions={<button>返回</button>}
      />
    );
    expect(screen.getByText("面包屑")).toBeTruthy();
    expect(screen.getByText("需求 · 001")).toBeTruthy();
    expect(screen.getByText("DOING")).toBeTruthy();
    expect(screen.getByText("状态")).toBeTruthy();
    expect(screen.getByText("开发中")).toBeTruthy();
    expect(screen.getByText("优先级")).toBeTruthy();
    expect(screen.getByText("通过")).toBeTruthy();
    expect(screen.getByText("返回")).toBeTruthy();
  });
});

describe("patterns · TimelineBurndown", () => {
  const reqs: BurndownRequirement[] = [
    {
      id: "r1",
      status: "done",
      timeline: [
        { at: "2026-08-01T09:00:00Z", to: "todo" },
        { at: "2026-08-03T09:00:00Z", to: "done" },
      ],
    },
    {
      id: "r2",
      status: "developing",
      timeline: [{ at: "2026-08-02T09:00:00Z", to: "developing" }],
    },
  ];

  it("渲染标题与 SVG 图表（理想线 + 实际线）", () => {
    const { container } = render(
      <TimelineBurndown startDate="2026-08-01" endDate="2026-08-07" requirements={reqs} />
    );
    expect(screen.getByText("燃尽图")).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("空需求时渲染空态提示", () => {
    render(<TimelineBurndown startDate="2026-08-01" endDate="2026-08-07" requirements={[]} />);
    expect(screen.getByText(/尚无需求/)).toBeTruthy();
  });
});
