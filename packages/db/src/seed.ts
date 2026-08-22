import "dotenv/config";
import { createDb, withTenantContext } from "./client.js";
import { campuses, organizations, teams, users, organizationMembers } from "./schema/index.js";

/**
 * Local-dev seed: creates one demo church with a default campus, an
 * admin user, and one team. Uses DATABASE_URL_SYSTEM (the BYPASSRLS
 * `pylr_system` role) for the org-creation step, exactly like the real
 * onboarding flow does — see apps/api/src/modules/organizations.
 */
async function main() {
  const systemUrl = process.env.DATABASE_URL_SYSTEM ?? process.env.DATABASE_URL;
  if (!systemUrl) {
    throw new Error("Set DATABASE_URL_SYSTEM (or DATABASE_URL) before seeding.");
  }
  const db = createDb(systemUrl);

  const [org] = await db
    .insert(organizations)
    .values({ name: "Grace Community Church", slug: "grace-community" })
    .onConflictDoNothing({ target: organizations.slug })
    .returning();

  const orgRow =
    org ??
    (await db.query.organizations.findFirst({
      where: (o, { eq }) => eq(o.slug, "grace-community"),
    }));
  if (!orgRow) throw new Error("Failed to create or find demo organization");

  const [user] = await db
    .insert(users)
    .values({
      authProviderId: "seed|demo-admin",
      email: "admin@gracecommunity.example",
      firstName: "Demo",
      lastName: "Admin",
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  const userRow =
    user ??
    (await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, "admin@gracecommunity.example"),
    }));
  if (!userRow) throw new Error("Failed to create or find demo user");

  await withTenantContext(db, { organizationId: orgRow.id, userId: userRow.id }, async (tx) => {
    await tx
      .insert(campuses)
      .values({ organizationId: orgRow.id, name: "Main Campus", isDefault: true })
      .onConflictDoNothing();

    await tx
      .insert(organizationMembers)
      .values({ organizationId: orgRow.id, userId: userRow.id, role: "org_admin", status: "active" })
      .onConflictDoNothing({ target: [organizationMembers.organizationId, organizationMembers.userId] });

    await tx
      .insert(teams)
      .values({ organizationId: orgRow.id, name: "Worship Team", type: "ministry" })
      .onConflictDoNothing();
  });

  console.log(`Seeded org "${orgRow.name}" (${orgRow.id}) with admin ${userRow.email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
