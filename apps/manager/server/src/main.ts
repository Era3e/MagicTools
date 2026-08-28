import { loadRootEnv } from "@mt/config";
loadRootEnv();

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate } from "./db";
import { rawBodyMiddleware } from "./raw-body.middleware";

const PORT = Number(process.env.PORT ?? 5004);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/manager");
  app.enableCors();
  // raw-body 中间件：webhook 签名校验需要原始 body
  app.use(rawBodyMiddleware());
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
