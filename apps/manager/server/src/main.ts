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

  try {
    await ensureDatabase();
    await migrate();
    console.log("migrations applied");
  } catch (err) {
    await app.close();
    throw err;
  }
  await app.listen(PORT);
  console.log("manager-server ready on " + PORT);
}

bootstrap().catch((error) => {
  console.error("startup failed: " + String(error));
  process.exit(1);
});
