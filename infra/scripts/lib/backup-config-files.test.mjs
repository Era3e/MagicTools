import test from "node:test";
import assert from "node:assert/strict";
import { inspectConfigurationFiles } from "./backup-config-files.mjs";

const source = { dataDirectory: "/pg/data_16", configFile: "/pg/data_16/postgresql.conf", hbaFile: "/pg/data_16/pg_hba.conf", identFile: "/pg/data_16/pg_ident.conf" };
function access(files) {
  return { readFile: async (file) => files[file] ?? null,
    listDirectory: async (directory) => Object.keys(files).filter((file) => file.startsWith(directory + "/") && !file.slice(directory.length + 1).includes("/")).map((file) => file.slice(directory.length + 1)) };
}
const baseline = () => ({ [source.configFile]: "# PostgreSQL\n", [source.hbaFile]: "local all all trust\n", [source.identFile]: "# mappings\n" });

test("即使外部include文件为空，PG、HBA和ident配置也必须拒绝漏备", async () => {
  for (const key of ["configFile", "hbaFile", "identFile"]) {
    const files = baseline();
    files[source[key]] = key === "configFile" ? "include = '/pg/dataX16/empty.conf'\n" : "include /pg/dataX16/empty.conf\n";
    files["/pg/dataX16/empty.conf"] = "# comments only\n";
    await assert.rejects(inspectConfigurationFiles(source, access(files)), /目录以外/);
  }
});

test("允许内部嵌套include、空文件和include_dir，记录真实依赖并忽略目录无关文件", async () => {
  const files = baseline();
  files[source.configFile] = "include 'nested/child.conf'\ninclude_if_exists 'absent.conf'\ninclude_dir 'settings'\n";
  files["/pg/data_16/nested/child.conf"] = "include '../empty.conf'\n";
  files["/pg/data_16/empty.conf"] = "# empty\n";
  files["/pg/data_16/settings/a.conf"] = "include '../last.conf'\n";
  files["/pg/data_16/last.conf"] = "";
  files["/pg/data_16/settings/.hidden.conf"] = "include '/outside/hidden.conf'\n";
  files["/pg/data_16/settings/ignored.txt"] = "include '/outside/ignored.conf'\n";
  files[source.hbaFile] = 'include "auth folder/child"\n';
  files["/pg/data_16/auth folder/child"] = "local all all trust\n";
  files["/pg/data_16/postgresql.auto.conf"] = "# automatic settings\n";
  const actual = await inspectConfigurationFiles(source, access(files));
  assert.deepEqual(actual.files, Object.keys(files).filter((file) => !file.endsWith(".hidden.conf") && !file.endsWith("ignored.txt")).sort());
  assert.deepEqual(actual.missingOptionalFiles, ["/pg/data_16/absent.conf"]);
  files["/pg/data_16/last.conf"] = "include '/outside/empty.conf'\n";
  await assert.rejects(inspectConfigurationFiles(source, access(files)), /目录以外/);
});

test("遵循PG转义和认证文件双引号、续行及递归@文件展开，保留内部引用", async () => {
  const files = baseline();
  files[source.configFile] = "INCLUDE = 'nested/quote''name.conf' # comment\ninclude 'nested/\\303\\251.conf'\ninclude 'nested/\\😀.conf'\n";
  files["/pg/data_16/nested/quote'name.conf"] = "# empty\n";
  files["/pg/data_16/nested/é.conf"] = "";
  files["/pg/data_16/nested/😀.conf"] = "";
  files[source.hbaFile] = 'include \\\n "auth ""quoted"" child"\nhost all @"names list" 127.0.0.1/32 scram-sha-256\nhost all "@literal" 127.0.0.1/32 reject\n';
  files['/pg/data_16/auth "quoted" child'] = "local all all trust\n";
  files["/pg/data_16/names list"] = "alice,bob\ninclude more-users\n";
  files["/pg/data_16/more-users"] = "carol,@nested-users\n";
  files["/pg/data_16/nested-users"] = "dave\n";
  const actual = await inspectConfigurationFiles(source, access(files));
  assert.deepEqual(actual.files, Object.keys(files).sort());
  files["/pg/data_16/nested-users"] = "@/outside/empty-users\n";
  await assert.rejects(inspectConfigurationFiles(source, access(files)), /目录以外/);
});
