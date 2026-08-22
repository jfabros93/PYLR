import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDb } from "@pylr/db";
import type { Env } from "../../config/env";
import { APP_DB, SYSTEM_DB } from "./db.tokens";

/**
 * Provides the two Postgres connections the API is allowed to use:
 *  - APP_DB (`pylr_app` role): every tenant-scoped query, always run
 *    through `withTenantContext` (@pylr/db) so RLS applies.
 *  - SYSTEM_DB (`pylr_system` role, BYPASSRLS): the small set of
 *    legitimately cross-tenant operations — org creation intake, Clerk
 *    webhook user sync, platform admin tooling. Never inject this into a
 *    request path that takes tenant-scoped input.
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createDb(config.get("DATABASE_URL_APP", { infer: true })),
    },
    {
      provide: SYSTEM_DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createDb(config.get("DATABASE_URL_SYSTEM", { infer: true })),
    },
  ],
  exports: [APP_DB, SYSTEM_DB],
})
export class DbModule {}
