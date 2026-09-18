import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { PreviewWorkerModule } from "./preview-worker.module";

async function bootstrap() {
  await NestFactory.createApplicationContext(PreviewWorkerModule, {
    logger: ["error", "warn", "log"],
  });
  Logger.log("Preview worker is ready.", "PreviewWorker");
}

void bootstrap();
