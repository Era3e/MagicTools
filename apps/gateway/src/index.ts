import { loadRootEnv } from "@mt/config";
loadRootEnv();

import { loadYamlFile } from "@mt/config";
import { createGateway } from "./app";
import { findPortsFile } from "./ports-file";
import type { PortsConfig } from "./routes";

const ports = loadYamlFile(findPortsFile(process.cwd())) as PortsConfig;
const app = createGateway(ports);
app.listen(3000, () => {
  console.log("gateway listening on http://127.0.0.1:3000");
});
