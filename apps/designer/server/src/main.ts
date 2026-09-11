import { loadRootEnv } from "@mt/config";
loadRootEnv();

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate } from "./db";

const PORT = Number(process.env.PORT ?? 5005);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/designer");
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
  console.log("designer-server ready on " + PORT);
}

bootstrap().catch((error) => {
  console.error("startup failed: " + String(error));
  process.exit(1);
});
