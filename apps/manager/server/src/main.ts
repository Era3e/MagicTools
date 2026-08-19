import { loadRootEnv } from "@mt/config";
loadRootEnv();

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate } from "./db";

const PORT = Number(process.env.PORT ?? 5004);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/manager");
  app.enableCors();
  await app.listen(PORT);
  console.log("manager-server listening on " + PORT);

  try {
    await ensureDatabase();
    await migrate();
    console.log("migrations applied");
  } catch (err) {
    console.warn("db unavailable, continuing: " + String(err));
  }
}

bootstrap();
