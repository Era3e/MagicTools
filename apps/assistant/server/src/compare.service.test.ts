import { describe, expect, it } from "vitest";
import { compareValues, extractNumbers } from "./compare.service";

describe("extractNumbers", () => {
  it("提取千分位与小数", () => {
    expect(extractNumbers("本月销售额 12,345.67 元")).toEqual([12345.67]);
  });
  it("万/亿/k 单位归一", () => {
    expect(extractNumbers("约 1.2万，累计 3亿，延迟 5k ms")).toEqual([12000, 300000000, 5000]);
  });
  it("百分比归一为比例", () => {
    expect(extractNumbers("增长 12.5%")).toEqual([0.125]);
  });
  it("多数值全提取", () => {
    expect(extractNumbers("销售额 12345 元，环比 9,876 元")).toEqual([12345, 9876]);
  });
  it("无数值返回空数组", () => {
    expect(extractNumbers("暂无数据")).toEqual([]);
  });
});

describe("compareValues", () => {
  it("1% 内一致", () => {
    expect(compareValues(12345, [12400]).status).toBe("consistent");
  });
  it("超差分歧并记录 diffPct", () => {
    const r = compareValues(12345, [99999]);
    expect(r.status).toBe("divergent");
    expect(r.diffPct).toBeGreaterThan(700);
  });
  it("智能体无数值为 unverifiable", () => {
    expect(compareValues(12345, []).status).toBe("unverifiable");
  });
  it("多数值任一命中即一致", () => {
    expect(compareValues(12345, [100, 12345]).status).toBe("consistent");
  });
  it("容差可调", () => {
    expect(compareValues(100, [102], 0.03).status).toBe("consistent");
    expect(compareValues(100, [102], 0.01).status).toBe("divergent");
  });
});
