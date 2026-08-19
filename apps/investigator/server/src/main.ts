import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate } from "./db";

const PORT = Number(process.env.PORT ?? 5002);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/investigator");
  app.enableCors();
  await app.listen(PORT);
  console.log("investigator-server listening on " + PORT);

  // 数据库断连降级：PG 不可用不影响服务启动
  try {
    await ensureDatabase();
    await migrate();
    console.log("migrations applied");
  } catch (err) {
    console.warn("db unavailable, continuing: " + String(err));
  }
}

bootstrap();
