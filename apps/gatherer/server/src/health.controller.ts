import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { join } from "node:path";
import { databaseReadiness } from "@mt/db";
import { pool } from "./db";

@Controller("health")
export class HealthController {
  @Get()
  health() { return { status: "up", service: "gatherer-server" }; }

  @Get("ready")
  async ready() {
    const status = await databaseReadiness(pool, join(__dirname, "..", "migrations"));
    if (!status.ready) throw new ServiceUnavailableException(status);
    return { ...status, service: "gatherer-server" };
  }
}
