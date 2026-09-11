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

  try {
    await ensureDatabase();
    await migrate();
    console.log("migrations applied");
    await startScheduler(new CollectService());
  } catch (err) {
    await app.close();
    throw err;
  }
  await app.listen(PORT);
  console.log("gatherer-server ready on " + PORT);
}

bootstrap().catch((error) => {
  console.error("startup failed: " + String(error));
  process.exit(1);
});
