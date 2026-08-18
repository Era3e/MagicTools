import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const PORT = Number(process.env.PORT ?? 5003);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/assessor");
  app.enableCors();
  await app.listen(PORT);
  console.log("assessor-server listening on " + PORT);
}

bootstrap();
