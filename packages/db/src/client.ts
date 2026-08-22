import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(connectionString: string): Database {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export interface TenantContext {
  organizationId: string;
  userId?: string;
}

/**
 * Runs `fn` inside a Postgres transaction with `app.current_org_id` (and,
 * when known, `app.current_user_id`) set for the lifetime of that
 * transaction via `set_config(..., true)` — the `true` makes it
 * transaction-local, equivalent to `SET LOCAL`, so it can never leak onto
 * a pooled connection's next caller.
 *
 * This is the ONLY sanctioned way tenant-scoped queries should run against
 * the `pylr_app` role. The RLS policies in migrations/0001_rls.sql key off
 * exactly these two settings, and — because the app role is neither the
 * table owner nor a superuser/BYPASSRLS role (see migrations/0002_roles.sql)
 * — Postgres enforces them even if application code forgets to filter by
 * organization_id. See apps/api/src/common/guards/tenant-context.guard.ts,
 * which calls this once per request using the organizationId taken from
 * the verified JWT — never from client-supplied input.
 */
export async function withTenantContext<T>(
  db: Database,
  ctx: TenantContext,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_org_id', ${ctx.organizationId}, true)`,
    );
    if (ctx.userId) {
      await tx.execute(
        sql`select set_config('app.current_user_id', ${ctx.userId}, true)`,
      );
    }
    return fn(tx as unknown as Database);
  });
}

/**
 * Like withTenantContext, but scoped only by user — no
 * app.current_org_id is set. Used for the handful of legitimately
 * cross-org queries a user makes about themselves (e.g. "which
 * organizations do I belong to?"), which the RLS self-visibility branch
 * on organization_members/users allows without needing a specific org
 * already selected. See packages/db/migrations/0001_rls.sql.
 */
export async function withUserContext<T>(
  db: Database,
  userId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_user_id', ${userId}, true)`,
    );
    return fn(tx as unknown as Database);
  });
}
