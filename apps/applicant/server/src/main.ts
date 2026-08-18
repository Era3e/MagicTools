import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { createPool } from "@mt/db";
import { AppModule } from "./app.module";

const PORT = Number(process.env.PORT ?? 5008);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/applicant");
  app.enableCors();
  await app.listen(PORT);
  console.log("applicant-server listening on " + PORT);

  // 数据库断连降级：PG 不可用不影响服务启动（健康检查保持 up）
  const pool = createPool(process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/magictools");
  try {
    await pool.query("SELECT 1");
    console.log("db connected");
  } catch (err) {
    console.warn("db unavailable, continuing: " + String(err));
  }
}

bootstrap();
