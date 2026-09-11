import { loadRootEnv } from "@mt/config";
loadRootEnv();

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate } from "./db";

const PORT = Number(process.env.PORT ?? 5003);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/assessor");
  app.enableCors();

  try {
    await ensureDatabase();
    await migrate();
    console.log("migrations applied");
  } catch (err) {
    await app.close();
    throw err;
  }
  await app.listen(PORT);
  console.log("assessor-server ready on " + PORT);
}

bootstrap().catch((error) => {
  console.error("startup failed: " + String(error));
  process.exit(1);
});
