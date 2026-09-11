import { vi } from "vitest";

// 普通单测允许构造惰性连接池，但绝不发起数据库 I/O；遗漏的集成用例必须显式进入 test:db。
vi.mock("pg", async (importOriginal) => {
  const actual = await importOriginal();
  const forbidden = () => { throw new Error("普通单测禁止数据库连接/查询，请将真实数据库用例登记到 test:db"); };
  class UnitPool extends actual.Pool {
    query() { return forbidden(); }
    connect() { return forbidden(); }
  }
  class UnitClient extends actual.Client {
    query() { return forbidden(); }
    connect() { return forbidden(); }
  }
  return { ...actual, Pool: UnitPool, Client: UnitClient,
    default: { ...actual.default, Pool: UnitPool, Client: UnitClient } };
});
