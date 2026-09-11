import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { digestBytes } from "./release-artifacts.mjs";

export function deploymentFixture() {
  const directory = mkdtempSync(join(tmpdir(), "mt-deployment-test-"));
  const releaseDirectory = join(directory, "release"); mkdirSync(releaseDirectory);
  const revision = "a".repeat(40);
  const files = { "ports.json": JSON.stringify({ gateway: { web: 3000 }, manager: { web: 4004, server: 5004 } }),
    "compose.json": JSON.stringify({ services: { gateway: { image: "unset", environment: { GATEWAY_TOKEN: "${GATEWAY_TOKEN:-}" } },
      "manager-server": { image: "unset" }, "manager-web": { image: "unset" },
      postgres: { image: "pgvector/pgvector:pg16@sha256:" + "b".repeat(64), volumes: ["pgdata:/var/lib/postgresql/data", "./postgres-init.sql:/docker-entrypoint-initdb.d/init.sql:ro"] } }, volumes: { pgdata: {} } }),
    "postgres-init.sql": "SELECT 1;\n" };
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(releaseDirectory, name), bytes);
  const release = { schema: "magictools-release/1", success: true, mode: "release", releaseId: revision + "-1234567890abcdef", revision, platform: "linux/amd64",
    source: { clean: true, checkoutSha: revision, fingerprint: "c".repeat(64) },
    files: Object.entries(files).map(([path, bytes]) => ({ path, sha256: digestBytes(bytes) })),
    images: ["gateway", "manager-server", "manager-web"].map((service) => ({ service, repository: "localhost:55101/test/" + service,
      reference: "localhost:55101/test/" + service + "@sha256:" + "d".repeat(64), registryDigest: "sha256:" + "d".repeat(64),
      localImageId: "sha256:" + "e".repeat(64), revision, platform: "linux/amd64", healthcheck: true })) };
  writeFileSync(join(releaseDirectory, "release.json"), JSON.stringify(release));
  const configFile = join(directory, "config.json");
  writeFileSync(configFile, JSON.stringify({ schema: "magictools-deployment-config/1", project: "mt-validation-test", gatewayBind: "127.0.0.1", gatewayPort: 53199, waitTimeoutSeconds: 30 }));
  const secretsFile = join(directory, "existing.env"); writeFileSync(secretsFile, "GATEWAY_TOKEN=unit-secret-that-must-remain\n");
  return { releaseDirectory, configFile, secretsFile, stateDirectory: join(directory, "state"), directory };
}
