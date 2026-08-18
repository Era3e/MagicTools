import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const PORT = Number(process.env.PORT ?? 5002);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/investigator");
  app.enableCors();
  await app.listen(PORT);
  console.log("investigator-server listening on " + PORT);
}

bootstrap();
