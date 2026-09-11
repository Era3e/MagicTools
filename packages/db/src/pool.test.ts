import { expect, it, vi } from "vitest";
import { createPool } from "./pool";

it("空闲连接异常不会杀掉服务，也不记录含秘密的异常正文", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const pool = createPool("unused-for-unit-test");
  try {
    expect(() => pool.emit("error", Object.assign(new Error("private-connection-secret"), { code: "57P01" }))).not.toThrow();
    expect(warning).toHaveBeenCalledWith("[database] idle connection failed", "57P01");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private-connection-secret");
  } finally { await pool.end(); warning.mockRestore(); }
});
