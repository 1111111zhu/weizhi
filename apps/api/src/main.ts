import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { toNodeHandler } from "better-auth/node";
import { json, urlencoded } from "express";
import type { NextFunction, Request, Response } from "express";

import { AppModule } from "./app.module";
import { BETTER_AUTH_BASE_PATH } from "./auth/better-auth-options";
import { BetterAuthService } from "./auth/better-auth.service";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { isAllowedCorsOrigin, resolveCorsOrigins } from "./cors";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const httpAdapter = app.getHttpAdapter().getInstance() as {
    set?: (setting: string, value: unknown) => void;
  };
  httpAdapter.set?.(
    "trust proxy",
    config.get<string | number>("TRUST_PROXY") ?? 1
  );
  const corsOrigins = resolveCorsOrigins(
    config.get<string>("FRONTEND_URL"),
    config.get<string>("FRONTEND_URLS")
  );
  const projectWingEnvironment = config.get<string>("PROJECTWING_ENVIRONMENT");
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void
    ) => {
      callback(
        null,
        isAllowedCorsOrigin(origin, corsOrigins, projectWingEnvironment)
      );
    },
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  });
  const betterAuth = app.get(BetterAuthService);
  app.use(
    BETTER_AUTH_BASE_PATH,
    (_request: Request, response: Response, next: NextFunction) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
      next();
    },
    toNodeHandler(betterAuth.auth)
  );
  app.use(
    json({
      verify: (request: Request & { rawBody?: Buffer }, _response, buffer) => {
        request.rawBody = Buffer.from(buffer);
      },
    })
  );
  app.use(urlencoded({ extended: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  const port = config.get<number>("API_PORT", 3000);
  await app.listen(port);
}

void bootstrap();
