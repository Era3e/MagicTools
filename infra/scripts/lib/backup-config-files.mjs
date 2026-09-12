import { posix } from "node:path";

// PG16配置语法参照guc-file.l、libpq/hba.c；这里只收集文件依赖，合法性仍由PG本身检查。
function postgresDirective(line) {
  const match = line.match(/^[ \t\r]*(include(?:_if_exists|_dir)?)(?=[ \t\r=]|$)[ \t\r]*(?:=[ \t\r]*)?/i);
  if (!match) return null;
  const text = line.slice(match[0].length);
  if (!text.startsWith("'")) {
    const value = text.match(/^[^\s#]+/)?.[0];
    if (!value) throw new Error("备份源配置include缺少路径");
    return { directive: match[1].toLowerCase(), target: value };
  }
  const chunks = []; let closed = false;
  for (let index = 1; index < text.length; index++) {
    let value = text[index];
    if (value === "'") {
      if (text[index + 1] === "'") { chunks.push(Buffer.from("'")); index++; continue; }
      closed = true; break;
    }
    if (value === "\\") {
      value = text[++index];
      if (value === undefined) throw new Error("备份源配置转义不完整");
      const octal = text.slice(index).match(/^[0-7]{1,3}/)?.[0];
      if (octal) { chunks.push(Buffer.from([parseInt(octal, 8) & 255])); index += octal.length - 1; continue; }
      if (text.codePointAt(index) > 0xffff) value = text.slice(index, ++index + 1);
      value = ({ b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" })[value] ?? value;
    } else if (text.codePointAt(index) > 0xffff) value = text.slice(index, ++index + 1);
    chunks.push(Buffer.from(value));
  }
  if (!closed) throw new Error("备份源配置引号不完整");
  let target;
  try { target = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); }
  catch { throw new Error("备份源配置文件名不是UTF-8"); }
  return { directive: match[1].toLowerCase(), target };
}

function authenticationFields(line) {
  let index = 0;
  const token = () => {
    while (index < line.length && /[ \t\r,]/.test(line[index])) index++;
    let value = ""; let quoted = false; let inQuote = false; let sawQuote = false;
    while (index < line.length) {
      const char = line[index];
      if (!inQuote && char === "#") { index = line.length; break; }
      if (!inQuote && /[ \t\r,]/.test(char)) break;
      index++;
      if (char === '"') {
        if (!value.length) quoted = true;
        sawQuote = true;
        if (inQuote && line[index] === '"') { value += '"'; index++; }
        else inQuote = !inQuote;
      } else value += char;
    }
    const comma = line[index] === ",";
    if (comma) index++;
    return value.length || sawQuote ? { value, quoted, comma } : null;
  };
  const fields = [];
  while (index < line.length) {
    const field = []; let current;
    do { current = token(); if (current) field.push(current); } while (current?.comma);
    if (field.length) fields.push(field);
    else break;
  }
  return fields;
}

export async function inspectConfigurationFiles(source, access) {
  const root = posix.normalize(source.dataDirectory).replace(/\/$/, "");
  const files = new Set(); const missing = new Set(); const visited = new Map(); const active = new Set();
  const check = (file, directory = false) => {
    if (typeof file !== "string" || !file.startsWith("/") || file.includes("\0")) throw new Error("备份源配置文件路径非法");
    const normalized = posix.normalize(file);
    if (!(directory && normalized === root) && !normalized.startsWith(root + "/")) throw new Error("备份源配置引用数据目录以外的文件或目录");
    return normalized;
  };
  const visit = async (name, kind, optional = false, depth = 0) => {
    const file = check(name); const key = kind + ":" + file;
    if (active.has(key) || depth > 10) throw new Error("备份源配置依赖循环或层数超限");
    if (visited.has(key)) return visited.get(key);
    const text = await access.readFile(file);
    if (text === null && optional) { missing.add(file); return []; }
    if (typeof text !== "string") throw new Error("备份源配置文件缺失或无法读取");
    files.add(file); active.add(key);
    const include = async ({ directive, target: relative }) => {
      if (!relative || relative.includes("\0")) throw new Error("备份源配置include路径非法");
      const target = posix.resolve(posix.dirname(file), relative);
      if (directive === "include_dir") {
        const directory = check(target, true); const names = await access.listDirectory(directory);
        if (!Array.isArray(names)) throw new Error("备份源配置目录缺失或无法读取");
        const lines = [];
        for (const child of names.filter((name) => !name.startsWith(".") && name.endsWith(".conf")).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))) {
          if (child.includes("/")) throw new Error("备份源配置目录成员非法");
          lines.push(...await visit(posix.join(directory, child), kind, false, depth + 1));
        }
        return lines;
      }
      return visit(target, kind, directive === "include_if_exists", depth + 1);
    };
    const result = [];
    const logical = kind === "auth" ? text.replace(/\\(?:\r?\n|$)/g, "") : text;
    for (const line of logical.split(/\r?\n/)) {
      if (kind === "postgres") {
        const directive = postgresDirective(line);
        if (directive) await include(directive);
        continue;
      }
      const fields = [];
      for (const field of authenticationFields(line)) {
        const expanded = [];
        for (const item of field) {
          if (!item.quoted && item.value.startsWith("@") && item.value.length > 1) {
            const nested = await visit(posix.resolve(posix.dirname(file), item.value.slice(1)), kind, false, depth + 1);
            expanded.push(...nested.flat(2));
          } else expanded.push(item);
        }
        if (expanded.length) fields.push(expanded);
      }
      const directive = fields[0]?.[0]?.value;
      if (fields.length === 2 && ["include", "include_if_exists", "include_dir"].includes(directive)) {
        result.push(...await include({ directive, target: fields[1][0].value }));
      } else if (fields.length) result.push(fields);
    }
    active.delete(key); visited.set(key, result); return result;
  };
  await visit(source.configFile, "postgres");
  await visit(posix.join(root, "postgresql.auto.conf"), "postgres", true);
  await visit(source.hbaFile, "auth");
  await visit(source.identFile, "auth");
  missing.delete(posix.join(root, "postgresql.auto.conf"));
  return { files: [...files].sort(), missingOptionalFiles: [...missing].sort() };
}
