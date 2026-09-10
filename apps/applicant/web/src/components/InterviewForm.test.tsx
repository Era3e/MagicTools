import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { InterviewForm } from "./InterviewForm";

describe("InterviewForm", () => {
  afterEach(() => cleanup());

  it("默认模式保存复盘需要问答记录", async () => {
    const onSubmit = vi.fn();
    render(<InterviewForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /保\s*存\s*复\s*盘/ }));
    expect(await screen.findByText("请输入问答记录")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("计划模式免填问答记录并携带 status 与时间", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<InterviewForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /记\s*为\s*计\s*划/ }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), { timeout: 10000 });
    const arg = onSubmit.mock.calls[0][0] as { status: string; happenedAt: string; qaNotes: string };
    expect(arg.status).toBe("scheduled");
    expect(arg.happenedAt).toBeTruthy();
    expect(arg.qaNotes).toBe("");
  });
});
