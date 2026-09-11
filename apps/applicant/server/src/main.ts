import { loadRootEnv } from "@mt/config";
loadRootEnv();

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { migrate } from "./db";
import { AppModule } from "./app.module";

const PORT = Number(process.env.PORT ?? 5008);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/applicant");
  app.enableCors();

  try {
    await migrate();
    console.log("migrations applied");
  } catch (err) {
    await app.close();
    throw err;
  }
  await app.listen(PORT);
  console.log("applicant-server ready on " + PORT);
}

bootstrap().catch((error) => {
  console.error("startup failed: " + String(error));
  process.exit(1);
});
