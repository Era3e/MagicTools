import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { digestBytes, validateReleaseManifest } from "./release-artifacts.mjs";
import { runtimeCatalog } from "./runtime-artifacts.mjs";
import { assertDeploymentValidationIsolation } from "./deployment-validation.mjs";
import { recoveryConnectionFields } from "./recovery-connections.mjs";

export function parseRecoveryValidationArgs(argv) {
  const options = {}, fields = { "--previous": "previousDirectory", "--current": "currentDirectory" };
  for (let index = 0; index < argv.length;) {
    if (argv[index] === "--config-change" && !options.configChange) { options.configChange = true; index++; continue; }
    const field = fields[argv[index]], value = argv[index + 1];
    if (!field || options[field] || !value || value.startsWith("--")) throw new Error("用法：validate-recovery-deployment --previous <上一版目录> --current <当前版目录>");
    options[field] = value;
    index += 2;
  }
  if (!options.previousDirectory || !options.currentDirectory) throw new Error("必须指定previous和current两个制品目录");
  return options;
}

function releaseDirectory(directory) {
  try { const actual = realpathSync(directory); if (!lstatSync(actual).isDirectory()) throw new Error(); return actual; }
  catch { throw new Error("恢复验收制品目录不存在或不可读取"); }
}
function bytes(file) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw new Error("恢复验收制品文件必须为大小有效的普通文件");
  return readFileSync(file);
}

export function inspectRecoveryValidationReleases(previousDirectory, currentDirectory, { configChange = false, allowValidation = false } = {}) {
  if (typeof configChange !== "boolean" || typeof allowValidation !== "boolean") throw new Error("验收模式必须显式使用布尔值");
  const releases = [previousDirectory, currentDirectory].map((directory) => {
    const actual = releaseDirectory(directory);
    const manifestBytes = bytes(join(actual, "release.json")), release = JSON.parse(manifestBytes.toString("utf8"));
    const portsBytes = bytes(join(actual, "ports.json")), catalog = runtimeCatalog(JSON.parse(portsBytes.toString("utf8")));
    validateReleaseManifest(release, catalog, { allowValidation });
    for (const image of release.images) {
      const host = image.repository.split("/")[0], match = /^(?:localhost|127\.0\.0\.1):([0-9]+)$/.exec(host);
      if (!match || Number(match[1]) < 1 || Number(match[1]) > 65535 || Number(match[1]) === 5432) throw new Error("恢复验收仅允许显式本机测试registry端口，不能使用5432");
    }
    const contents = {};
    for (const file of release.files) {
      const content = bytes(join(actual, file.path));
      if (digestBytes(content) !== file.sha256) throw new Error("恢复验收制品文件摘要不符");
      contents[file.path] = content;
    }
    assertDeploymentValidationIsolation(JSON.parse(contents["compose.json"].toString("utf8")), catalog, release.images);
    return { directory: actual, release, catalog, contents, manifestBytes, manifestSha256: digestBytes(manifestBytes) };
  });
  const [previous, current] = releases;
  const source = JSON.parse(current.contents["compose.json"].toString("utf8"));
  const privateBinding = (value, variable) => typeof value === "string" && new RegExp("^\\$\\{" + variable + "(?::[?-][^{}]*)?\\}$").test(value);
  if (!privateBinding(source.services?.postgres?.environment?.POSTGRES_PASSWORD, "POSTGRES_PASSWORD")) throw new Error("current源平台的POSTGRES_PASSWORD必须引用私有env，不能使用字面密码");
  for (const field of recoveryConnectionFields(current.catalog)) {
    if (!privateBinding(source.services?.[field.service]?.environment?.[field.field], field.variable)) throw new Error("current源平台的" + field.variable + "必须引用私有env，不能使用字面连接");
  }
  const databases = current.catalog.filter((item) => item.kind === "node" && item.app !== "gateway").map((item) => item.app).sort();
  if (current.catalog.length !== 17 || JSON.stringify(databases) !== JSON.stringify(["applicant", "assessor", "assistant", "designer", "gatherer", "investigator", "manager", "scholar"])) throw new Error("恢复验收必须覆盖17应用和完整八库");
  if (previous.release.revision === current.release.revision && !configChange) throw new Error("恢复验收要求两份不同源码revision的固定制品；同制品需显式config-change");
  if (previous.release.platform !== current.release.platform || JSON.stringify(previous.catalog) !== JSON.stringify(current.catalog)) throw new Error("两份恢复验收制品的平台或应用清单不一致");
  return { previous, current, catalog: current.catalog, databases, releaseComparison: previous.release.revision === current.release.revision ? "config-change" : "distinct-revisions" };
}

export class RecoveryValidationResources {
  constructor(docker) { this.docker = docker; this.records = []; }
  optional(kind, reference) {
    try { const values = JSON.parse(this.docker([kind, "inspect", reference])); if (!Array.isArray(values) || values.length !== 1) throw new Error(); return values[0]; }
    catch {
      const values = this.docker([kind, "ls", ...kind === "container" ? ["--all", "--no-trunc"] : kind === "network" || kind === "image" ? ["--no-trunc"] : [], "--format", kind === "volume" ? "{{.Name}}" : "{{.ID}}"])
        .split(/\r?\n/).filter(Boolean);
      if (values.includes(reference)) throw new Error("资源存在但无法核对身份");
      if (kind !== "volume" && !/^(?:sha256:)?[a-f0-9]{64}$/.test(reference)) {
        const names = this.docker([kind, "ls", ...kind === "container" ? ["--all"] : [], "--format", kind === "container" ? "{{.Names}}" : kind === "image" ? "{{.Repository}}:{{.Tag}}" : "{{.Name}}"]);
        if (names.split(/\r?\n/).includes(reference)) throw new Error("同名资源无法读取");
      }
      return null;
    }
  }
  remember(kind, name, labels, extra = {}) {
    const value = JSON.parse(this.docker([kind, "inspect", name]))[0];
    const actualLabels = kind === "container" || kind === "image" ? value.Config?.Labels : value.Labels;
    if (Object.entries(labels).some(([key, expected]) => actualLabels?.[key] !== expected)) throw new Error("验收资源归属不符");
    const identity = kind === "volume" ? value.CreatedAt : value.Id;
    if (kind === "volume" ? !Number.isFinite(Date.parse(identity)) : !/^(?:sha256:)?[a-f0-9]{64}$/.test(identity ?? "")) throw new Error("验收资源不可变身份缺失");
    const existing = this.records.find((entry) => entry.kind === kind && entry.identity === identity && entry.name === name);
    if (existing) return existing;
    const record = { kind, name, identity, labels: { ...labels }, ...extra }; this.records.push(record); return record;
  }
  remove(record) {
    const reference = record.kind === "volume" ? record.name : record.identity;
    const value = this.optional(record.kind, reference); if (!value) return;
    const labels = record.kind === "container" || record.kind === "image" ? value.Config?.Labels : value.Labels;
    if ((record.kind === "volume" ? value.CreatedAt : value.Id) !== record.identity || Object.entries(record.labels).some(([key, expected]) => labels?.[key] !== expected)) throw new Error("资源归属或ID变化，拒绝清理");
    if (record.kind === "image") {
      const references = [record.tag];
      if (record.reference !== undefined) {
        const repository = typeof record.tag === "string" ? record.tag.slice(0, record.tag.lastIndexOf(":")) : "";
        if (!repository || typeof record.reference !== "string" || !record.reference.startsWith(repository + "@sha256:") ||
          !/@sha256:[a-f0-9]{64}$/.test(record.reference) || !value.RepoDigests?.includes(record.reference)) throw new Error("故障镜像的发布digest归属不符，拒绝删除");
        references.push(record.reference);
      }
      // containerd可能把pull的digest引用也列入RepoTags，只允许本轮已记录的发布引用。
      if ((value.RepoTags ?? []).some((tag) => !references.includes(tag))) throw new Error("故障镜像存在其它标签，拒绝删除");
      if ((value.RepoDigests ?? []).some((reference) => reference !== record.reference)) throw new Error("故障镜像存在其它发布digest，拒绝删除");
      if (this.docker(["container", "ls", "--all", "--filter", "ancestor=" + record.identity, "--format", "{{.ID}}"]).trim()) throw new Error("故障镜像仍被容器使用");
      this.docker(["image", "rm", "--force", record.identity]);
    } else this.docker(record.kind === "container" ? ["rm", "-f", "-v", reference] : [record.kind, "rm", reference]);
  }
  cleanup() {
    const errors = [];
    for (const kind of ["container", "network", "volume", "image"]) for (const record of [...this.records].reverse().filter((entry) => entry.kind === kind)) {
      try { this.remove(record); } catch { errors.push({ kind, name: record.name, error: "OWNERSHIP_OR_REMOVAL_FAILED" }); }
    }
    return errors;
  }
}
