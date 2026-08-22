import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, withTenantContext, withUserContext, type Database } from "../src/client";
import { campuses, organizationMembers, organizations, teams, users } from "../src/schema";

/**
 * drizzle-orm/postgres-js wraps the raw driver error in its own
 * "Failed query: ..." error, with the actual PostgresError (whose
 * .message is what Postgres sent, e.g. "new row violates row-level
 * security policy...") attached as `.cause`. Asserting against
 * `.message` directly would just match the generic wrapper text, so this
 * digs out the real one.
 */
async function rejectsWithPgError(promise: Promise<unknown>, pattern: RegExp) {
  try {
    await promise;
    expect.unreachable("expected the query to reject");
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    const message = cause instanceof Error ? cause.message : String(cause);
    expect(message).toMatch(pattern);
  }
}

/**
 * Proves the tenant-isolation model actually holds at the database layer
 * — not just "the app remembered to add a WHERE clause". Every query here
 * connects as `pylr_app` (see 0002_roles.sql: not the table owner, not
 * BYPASSRLS), so if these pass, Postgres itself is refusing cross-tenant
 * access regardless of what application code does or doesn't filter by.
 *
 * This is the automated test flagged as the top Phase 0 risk in
 * docs/ARCHITECTURE.md.
 */

const APP_URL = process.env.DATABASE_URL_APP;
const SYSTEM_URL = process.env.DATABASE_URL_SYSTEM;
if (!APP_URL || !SYSTEM_URL) {
  throw new Error(
    "DATABASE_URL_APP / DATABASE_URL_SYSTEM must be set (copy packages/db/.env.example to .env) " +
      "and 0002_roles.sql's roles must have passwords set for local dev — see that file's header comment.",
  );
}

const appDb: Database = createDb(APP_URL);
const systemDb: Database = createDb(SYSTEM_URL);

let orgA: { id: string; slug: string };
let orgB: { id: string; slug: string };
let userA: { id: string };
let userB: { id: string };

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);

  // Setup runs on the BYPASSRLS system connection, mirroring how
  // OrganizationsService actually creates orgs/users in production —
  // this is not the thing under test.
  const [a] = await systemDb
    .insert(organizations)
    .values({ name: `RLS Test Org A ${suffix}`, slug: `rls-test-a-${suffix}` })
    .returning();
  const [b] = await systemDb
    .insert(organizations)
    .values({ name: `RLS Test Org B ${suffix}`, slug: `rls-test-b-${suffix}` })
    .returning();
  if (!a || !b) throw new Error("Failed to seed test organizations");
  orgA = a;
  orgB = b;

  const [ua] = await systemDb
    .insert(users)
    .values({ authProviderId: `rls-test|a-${suffix}`, email: `a-${suffix}@rls-test.example` })
    .returning();
  const [ub] = await systemDb
    .insert(users)
    .values({ authProviderId: `rls-test|b-${suffix}`, email: `b-${suffix}@rls-test.example` })
    .returning();
  if (!ua || !ub) throw new Error("Failed to seed test users");
  userA = ua;
  userB = ub;

  await systemDb.insert(organizationMembers).values([
    { organizationId: orgA.id, userId: userA.id, role: "org_admin", status: "active" },
    { organizationId: orgB.id, userId: userB.id, role: "org_admin", status: "active" },
  ]);
  await systemDb.insert(campuses).values([
    { organizationId: orgA.id, name: "Org A Campus", isDefault: true },
    { organizationId: orgB.id, name: "Org B Campus", isDefault: true },
  ]);
});

afterAll(async () => {
  // Cleanup on the system connection — cascades handle members/campuses/teams.
  await systemDb.delete(organizations).where(eq(organizations.id, orgA.id));
  await systemDb.delete(organizations).where(eq(organizations.id, orgB.id));
});

describe("cross-tenant isolation (pylr_app, RLS-enforced)", () => {
  it("reading organizations while scoped to org A never returns org B, even with no WHERE clause", async () => {
    const rows = await withTenantContext(appDb, { organizationId: orgA.id, userId: userA.id }, (tx) =>
      tx.select().from(organizations),
    );
    expect(rows.map((r) => r.id)).toContain(orgA.id);
    expect(rows.map((r) => r.id)).not.toContain(orgB.id);
  });

  it("reading org B's campuses while scoped to org A returns nothing", async () => {
    const rows = await withTenantContext(appDb, { organizationId: orgA.id, userId: userA.id }, (tx) =>
      tx.select().from(campuses).where(eq(campuses.organizationId, orgB.id)),
    );
    expect(rows).toHaveLength(0);
  });

  it("a crafted INSERT that names org B's id while scoped to org A is rejected by the database, not just skipped", async () => {
    await rejectsWithPgError(
      withTenantContext(appDb, { organizationId: orgA.id, userId: userA.id }, (tx) =>
        tx.insert(teams).values({ organizationId: orgB.id, name: "Smuggled team" }),
      ),
      /row-level security/i,
    );

    // Confirm nothing was smuggled in — not even scoped to org B directly,
    // since the transaction that attempted it was rolled back.
    const smuggled = await withTenantContext(appDb, { organizationId: orgB.id, userId: userB.id }, (tx) =>
      tx.select().from(teams).where(eq(teams.name, "Smuggled team")),
    );
    expect(smuggled).toHaveLength(0);
  });

  it("querying with no tenant context set at all returns zero rows (fail closed, not fail open)", async () => {
    const rows = await appDb.select().from(organizations).where(eq(organizations.id, orgA.id));
    expect(rows).toHaveLength(0);
  });

  it("a user can list only the orgs they belong to, without needing to already know which org to scope to", async () => {
    const rowsForA = await withUserContext(appDb, userA.id, (tx) =>
      tx.query.organizationMembers.findMany({
        where: eq(organizationMembers.userId, userA.id),
        with: { organization: true },
      }),
    );
    expect(rowsForA.map((m) => m.organization.id)).toEqual([orgA.id]);

    const rowsForB = await withUserContext(appDb, userB.id, (tx) =>
      tx.query.organizationMembers.findMany({
        where: eq(organizationMembers.userId, userB.id),
        with: { organization: true },
      }),
    );
    expect(rowsForB.map((m) => m.organization.id)).toEqual([orgB.id]);
  });

  it("the users table hides a user who shares no org with the caller", async () => {
    const rows = await withTenantContext(appDb, { organizationId: orgA.id, userId: userA.id }, (tx) =>
      tx.select().from(users).where(eq(users.id, userB.id)),
    );
    expect(rows).toHaveLength(0);
  });

  it("pylr_app cannot write to the users table under any tenant context (no INSERT/UPDATE policy exists)", async () => {
    await rejectsWithPgError(
      withTenantContext(appDb, { organizationId: orgA.id, userId: userA.id }, (tx) =>
        tx.insert(users).values({ authProviderId: `should-fail-${randomUUID()}`, email: `fail-${randomUUID()}@example.com` }),
      ),
      /row-level security/i,
    );
  });

  it("org creation goes through pylr_system only — pylr_app can never insert an organization, scoped or not", async () => {
    // The real path: OrganizationsService.createOrganization uses
    // SYSTEM_DB precisely because pylr_app has no INSERT policy on
    // organizations at all (see migrations/0001_rls.sql) — RETURNING a
    // freshly-created org also has to satisfy the SELECT policy, which is
    // structurally impossible before any tenant context exists.
    const slug = `rls-test-create-${randomUUID().slice(0, 8)}`;
    const [created] = await systemDb.insert(organizations).values({ name: "New org", slug }).returning();
    expect(created?.slug).toBe(slug);
    await systemDb.delete(organizations).where(eq(organizations.slug, slug));

    await rejectsWithPgError(
      appDb.insert(organizations).values({ name: "Should fail", slug: `rls-test-unscoped-fail-${randomUUID()}` }),
      /row-level security/i,
    );
    await rejectsWithPgError(
      withTenantContext(appDb, { organizationId: orgA.id, userId: userA.id }, (tx) =>
        tx.insert(organizations).values({ name: "Should fail", slug: `rls-test-scoped-fail-${randomUUID()}` }),
      ),
      /row-level security/i,
    );
  });

  it("a member can see their own org's profile via the self-membership branch, even fully unscoped", async () => {
    const rows = await withUserContext(appDb, userA.id, (tx) =>
      tx.select().from(organizations).where(eq(organizations.id, orgA.id)),
    );
    expect(rows).toHaveLength(1);

    // But NOT an org they don't belong to.
    const none = await withUserContext(appDb, userA.id, (tx) =>
      tx.select().from(organizations).where(eq(organizations.id, orgB.id)),
    );
    expect(none).toHaveLength(0);
  });
});
