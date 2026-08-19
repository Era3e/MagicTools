import { loadRootEnv } from "@mt/config";
loadRootEnv();

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const PORT = Number(process.env.PORT ?? __SERVER_PORT__);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/__NAME__");
  app.enableCors();
  await app.listen(PORT);
  console.log("__NAME__-server listening on " + PORT);
}

bootstrap();
