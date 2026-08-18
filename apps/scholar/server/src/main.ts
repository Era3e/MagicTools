import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const PORT = Number(process.env.PORT ?? 5006);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/scholar");
  app.enableCors();
  await app.listen(PORT);
  console.log("scholar-server listening on " + PORT);
}

bootstrap();
