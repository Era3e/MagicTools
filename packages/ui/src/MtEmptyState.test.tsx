import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MtEmptyState } from "./MtEmptyState";

describe("MtEmptyState（v2 品牌化空态）", () => {
  it("渲染标题与操作按钮，点击触发回调", () => {
    const onAction = vi.fn();
    render(<MtEmptyState title="暂无数据" actionText="去创建" onAction={onAction} />);
    expect(screen.getByText("暂无数据")).toBeTruthy();
    fireEvent.click(screen.getByText("去创建"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("不使用 AntD 默认简笔画插画（无 Empty.PRESENTED_IMAGE_DEFAULT）", () => {
    const { container } = render(<MtEmptyState title="暂无数据" />);
    // AntD Empty 默认插画为 svg；品牌化空态改用字符印记，不应存在 svg 插画
    expect(container.querySelector("svg")).toBeNull();
    // 品牌印记：eyebrow 风格「EMPTY · 无数据」上标行存在
    expect(container.textContent).toContain("EMPTY");
  });

  it("优先展示 description，title 作为主文案时保留", () => {
    render(<MtEmptyState title="暂无岗位在册" description="去后台录入第一条机会吧" />);
    expect(screen.getByText("暂无岗位在册")).toBeTruthy();
    expect(screen.getByText("去后台录入第一条机会吧")).toBeTruthy();
  });
});
