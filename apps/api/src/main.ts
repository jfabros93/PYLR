import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";

async function bootstrap() {
  // rawBody: true exposes request.rawBody so the Clerk webhook route can
  // verify svix's signature against the exact bytes Clerk sent — see
  // modules/auth/clerk-webhook.controller.ts.
  //
  // No global ValidationPipe here: request validation goes through
  // @pylr/schemas' Zod schemas via ZodValidationPipe, applied per-route
  // (see common/pipes/zod-validation.pipe.ts) — this app has no
  // class-validator DTOs for Nest's built-in ValidationPipe to act on.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors();

  const config = app.get(ConfigService<Env, true>);
  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  console.log(`@pylr/api listening on :${port}`);
}

bootstrap();
