import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { buildChecks, runChecks } from "../smoke.mjs";

test("buildChecks 为每个 web/server 与 gateway 生成检查项", () => {
  const checks = buildChecks({ applicant: { web: 4008, server: 5008 }, gateway: { web: 3000 } });
  // applicant-server + applicant-web + gateway（gateway 条目不生成 web/server 检查）
  assert.equal(checks.length, 3);
  assert.equal(checks.at(-1).name, "gateway");
  assert.deepEqual(
    checks.map((c) => c.name),
    ["applicant-server", "applicant-web", "gateway"]
  );
});

test("runChecks 正确标记成功与失败", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end("ok");
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const results = await runChecks(
    [
      { name: "ok", url: "http://127.0.0.1:" + port + "/" },
      { name: "bad", url: "http://127.0.0.1:1/" },
    ],
    1500
  );
  server.close();
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
});
