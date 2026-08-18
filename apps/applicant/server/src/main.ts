import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const PORT = Number(process.env.PORT ?? 5008);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/applicant");
  app.enableCors();
  await app.listen(PORT);
  console.log("applicant-server listening on " + PORT);
}

bootstrap();
