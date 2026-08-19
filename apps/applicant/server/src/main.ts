import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { migrate } from "./db";
import { AppModule } from "./app.module";

const PORT = Number(process.env.PORT ?? 5008);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/applicant");
  app.enableCors();
  await app.listen(PORT);
  console.log("applicant-server listening on " + PORT);

  // 数据库断连降级：PG 不可用不影响服务启动（健康检查保持 up）
  try {
    await migrate();
    console.log("migrations applied");
  } catch (err) {
    console.warn("db unavailable, continuing: " + String(err));
  }
}

bootstrap();
