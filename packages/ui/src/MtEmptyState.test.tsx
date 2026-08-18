import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MtEmptyState } from "./MtEmptyState";

describe("MtEmptyState", () => {
  it("渲染标题与操作按钮，点击触发回调", () => {
    const onAction = vi.fn();
    render(<MtEmptyState title="暂无数据" actionText="去创建" onAction={onAction} />);
    expect(screen.getByText("暂无数据")).toBeTruthy();
    fireEvent.click(screen.getByText("去创建"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
