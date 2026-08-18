import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const PORT = Number(process.env.PORT ?? 5004);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/manager");
  app.enableCors();
  await app.listen(PORT);
  console.log("manager-server listening on " + PORT);
}

bootstrap();
