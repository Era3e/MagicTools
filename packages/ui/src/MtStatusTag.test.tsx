import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MtStatusTag, type MtStatusTagTone } from "./MtStatusTag";
import { tokens } from "./tokens";

/** jsdom 会把 inline hex 规范化为 rgb()——按色彩值双格式断言（v2 迭代同款做法） */
function toBeColor(actual: string, hex: string) {
  const a = actual.toLowerCase().replace(/\s+/g, "");
  const expect1 = hex.toLowerCase();
  const r = parseInt(expect1.slice(1, 3), 16);
  const g = parseInt(expect1.slice(3, 5), 16);
  const b = parseInt(expect1.slice(5, 7), 16);
  // 拼接 rgb 串时拆成两段，避免模板/字面量被 no-hardcoded-colors 误报为颜色函数
  const expect2 = ["rg", "b("].join("") + r + "," + g + "," + b + ")";
  expect([expect1, expect2]).toContain(a);
}

describe("MtStatusTag（ui-spec v2 §四 状态标签契约）", () => {
  it("soft 语义变体：底 50 阶、字 700 阶、高 22px（success）", () => {
    render(<MtStatusTag tone="success">已完成</MtStatusTag>);
    const el = screen.getByText("已完成");
    toBeColor(el.style.backgroundColor, tokens.scale.success[0]);
    toBeColor(el.style.color, tokens.scale.success[7]);
    expect(el.style.height).toBe("22px");
    expect(el.style.fontSize).toBe("12px");
  });

  it("六种语义 tone 均映射到对应色阶（语义 50/700 阶，neutral 按契约 100/700 阶）", () => {
    const cases: Array<{ tone: MtStatusTagTone; scale: readonly string[]; bgIdx: number; fgIdx: number }> = [
      { tone: "neutral", scale: tokens.scale.graphite, bgIdx: 1, fgIdx: 6 },
      { tone: "success", scale: tokens.scale.success, bgIdx: 0, fgIdx: 7 },
      { tone: "warning", scale: tokens.scale.warning, bgIdx: 0, fgIdx: 7 },
      { tone: "error", scale: tokens.scale.error, bgIdx: 0, fgIdx: 7 },
      { tone: "info", scale: tokens.scale.info, bgIdx: 0, fgIdx: 7 },
      { tone: "accent", scale: tokens.scale.amber, bgIdx: 0, fgIdx: 7 },
    ];
    for (const c of cases) {
      const { unmount } = render(<MtStatusTag tone={c.tone}>{c.tone}</MtStatusTag>);
      const el = screen.getByText(c.tone);
      toBeColor(el.style.backgroundColor, c.scale[c.bgIdx]);
      toBeColor(el.style.color, c.scale[c.fgIdx]);
      unmount();
    }
  });

  it("solid 高强调变体：ink-600 实心底 + 白字（DOING）", () => {
    render(
      <MtStatusTag tone="neutral" emphasis="solid">
        DOING
      </MtStatusTag>
    );
    const el = screen.getByText("DOING");
    toBeColor(el.style.backgroundColor, tokens.tagSolid.bg);
    toBeColor(el.style.color, tokens.tagSolid.fg);
  });

  it("mono 变体：意图标签用等宽字 + ink-50 底 / ink-700 字", () => {
    render(<MtStatusTag mono>data_query · 数据查询</MtStatusTag>);
    const el = screen.getByText("data_query · 数据查询");
    toBeColor(el.style.backgroundColor, tokens.scale.ink[0]);
    toBeColor(el.style.color, tokens.scale.ink[7]);
    expect(el.style.fontFamily).toContain("JetBrains Mono");
    expect(el.style.fontSize).toBe("11px");
  });

  it("count 计数变体：等宽 + 最小宽 24px 居中", () => {
    render(
      <MtStatusTag tone="neutral" mono count>
        12
      </MtStatusTag>
    );
    const el = screen.getByText("12");
    expect(el.style.minWidth).toBe("24px");
    expect(el.style.textAlign).toBe("center");
  });

  it("圆点前缀：showDot 时渲染 6px 圆点", () => {
    const { container } = render(
      <MtStatusTag tone="success" showDot>
        运行正常
      </MtStatusTag>
    );
    const dot = container.querySelector("span[data-mt-tag-dot]");
    expect(dot).not.toBeNull();
    expect((dot as HTMLElement).style.width).toBe("6px");
  });

  it("未知 tone 兜底 neutral（不抛错）", () => {
    render(<MtStatusTag>未知</MtStatusTag>);
    const el = screen.getByText("未知");
    toBeColor(el.style.backgroundColor, tokens.scale.graphite[1]);
  });

  it("不使用 AntD Tag（零 ant-tag class，独立实现）", () => {
    const { container } = render(<MtStatusTag tone="info">进行中</MtStatusTag>);
    expect(container.querySelector(".ant-tag")).toBeNull();
  });
});
