import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const workflows = join(root, ".github/workflows");
for (const file of readdirSync(workflows).filter((name) => /\.ya?ml$/.test(name)).sort()) {
  test(`GitHub workflow ${file} 是合法 YAML 且没有重复字段`, () => {
    const doc = parseDocument(readFileSync(join(workflows, file), "utf8"), { uniqueKeys: true });
    assert.deepEqual(doc.errors.map((error) => error.message), []);
  });
}
