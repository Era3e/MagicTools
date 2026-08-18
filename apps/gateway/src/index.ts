import { join } from "node:path";
import { loadYamlFile } from "@mt/config";
import { createGateway } from "./app";
import type { PortsConfig } from "./routes";

const ports = loadYamlFile(join(process.cwd(), "infra", "ports.yaml")) as PortsConfig;
const app = createGateway(ports);
app.listen(3000, () => {
  console.log("gateway listening on http://127.0.0.1:3000");
});
