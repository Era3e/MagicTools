import { loadRootEnv } from "@mt/config";
loadRootEnv();

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { CollectService } from "./collect.service";
import { ensureDatabase, migrate } from "./db";
import { startScheduler } from "./scheduler";

const PORT = Number(process.env.PORT ?? 5001);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/gatherer");
  app.enableCors();
  await app.listen(PORT);
  console.log("gatherer-server listening on " + PORT);

  try {
    await ensureDatabase();
    await migrate();
    console.log("migrations applied");
    await startScheduler(new CollectService());
  } catch (err) {
    console.warn("db unavailable, continuing: " + String(err));
  }
}

bootstrap();
