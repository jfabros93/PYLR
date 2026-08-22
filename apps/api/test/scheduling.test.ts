import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createDb, eq, schema, withTenantContext, type Database } from "@pylr/db";
import { defineAbilityFor } from "@pylr/auth";
import type { OrgRole } from "@pylr/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PlansService } from "../src/modules/scheduling/plans.service";
import { ServicesService } from "../src/modules/scheduling/services.service";
import { ServingRolesService } from "../src/modules/scheduling/serving-roles.service";
import { SongsService } from "../src/modules/scheduling/songs.service";

/**
 * Exercises the whole Phase 1 scheduling module — create service, generate
 * occurrences, build a plan (speaker, song, assignment, announcement,
 * serving-role grid), publish, self-service confirm — against a real
 * Postgres instance running the actual migrations, the same way
 * packages/db/test/rls.test.ts proved Phase 0's tenant isolation. This
 * connects as `pylr_app`, so every query here is genuinely RLS-enforced,
 * not just app-code-correct.
 */

const APP_URL = process.env.DATABASE_URL_APP;
const SYSTEM_URL = process.env.DATABASE_URL_SYSTEM;
if (!APP_URL || !SYSTEM_URL) {
  throw new Error("DATABASE_URL_APP / DATABASE_URL_SYSTEM must be set — see docs/LOCAL_DEV.md");
}

const appDb: Database = createDb(APP_URL);
const systemDb: Database = createDb(SYSTEM_URL);

const servicesService = new ServicesService();
const plansService = new PlansService();
const songsService = new SongsService();
const servingRolesService = new ServingRolesService();

function tenantFor(organizationId: string, userId: string, role: OrgRole, leaderOfTeamIds: string[] = []) {
  return { organizationId, userId, role, ability: defineAbilityFor({ organizationId, role, leaderOfTeamIds }) };
}

let orgId: string;
let teamAId: string; // the worship team, led by leaderUser
let teamBId: string; // a second team leaderUser does NOT lead
let orgAdminUserId: string;
let leaderUserId: string;
let leaderPersonId: string; // people row linked to leaderUserId, for self-assignment tests
let memberUserId: string;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);

  const [org] = await systemDb
    .insert(schema.organizations)
    .values({ name: `Scheduling Test Org ${suffix}`, slug: `scheduling-test-${suffix}` })
    .returning();
  if (!org) throw new Error("org insert failed");
  orgId = org.id;

  const [teamA] = await systemDb
    .insert(schema.teams)
    .values({ organizationId: orgId, name: "Worship Team", type: "ministry" })
    .returning();
  const [teamB] = await systemDb
    .insert(schema.teams)
    .values({ organizationId: orgId, name: "Youth Ministry", type: "ministry" })
    .returning();
  if (!teamA || !teamB) throw new Error("team insert failed");
  teamAId = teamA.id;
  teamBId = teamB.id;

  const [admin] = await systemDb
    .insert(schema.users)
    .values({ authProviderId: `sched-test|admin-${suffix}`, email: `admin-${suffix}@sched-test.example` })
    .returning();
  const [leader] = await systemDb
    .insert(schema.users)
    .values({ authProviderId: `sched-test|leader-${suffix}`, email: `leader-${suffix}@sched-test.example` })
    .returning();
  const [member] = await systemDb
    .insert(schema.users)
    .values({ authProviderId: `sched-test|member-${suffix}`, email: `member-${suffix}@sched-test.example` })
    .returning();
  if (!admin || !leader || !member) throw new Error("user insert failed");
  orgAdminUserId = admin.id;
  leaderUserId = leader.id;
  memberUserId = member.id;

  await systemDb.insert(schema.organizationMembers).values([
    { organizationId: orgId, userId: orgAdminUserId, role: "org_admin", status: "active" },
    { organizationId: orgId, userId: leaderUserId, role: "team_leader", status: "active" },
    { organizationId: orgId, userId: memberUserId, role: "team_member", status: "active" },
  ]);
  await systemDb
    .insert(schema.teamMembers)
    .values({ organizationId: orgId, teamId: teamAId, userId: leaderUserId, role: "leader" });

  // A `people` row linked back to the leader's own account, so the
  // self-service confirm/decline path (assignee, not just team leader)
  // has something real to test against.
  const [leaderPerson] = await systemDb
    .insert(schema.people)
    .values({ organizationId: orgId, userId: leaderUserId, firstName: "Leader", lastName: "Person" })
    .returning();
  if (!leaderPerson) throw new Error("person insert failed");
  leaderPersonId = leaderPerson.id;
});

afterAll(async () => {
  await systemDb.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
});

describe("scheduling module (Phase 1, RLS-enforced via pylr_app)", () => {
  let serviceId: string;
  let occurrenceId: string;
  let planId: string;
  let songId: string;
  let planSongId: string;
  let servingRoleId: string;
  let roleAssignmentId: string;

  it("a team leader can create a service for their own team", async () => {
    const tenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const service = await withTenantContext(appDb, tenant, (tx) =>
      servicesService.createService(tx, tenant, teamAId, {
        name: "Sunday Morning Service",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=SU",
        defaultTime: "10:00",
        defaultDurationMinutes: 90,
        isPublic: true,
      }),
    );
    expect(service.teamId).toBe(teamAId);
    serviceId = service.id;
  });

  it("the same leader is rejected creating a service for a team they don't lead", async () => {
    const tenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    await expect(
      withTenantContext(appDb, tenant, (tx) =>
        servicesService.createService(tx, tenant, teamBId, { name: "Youth Night", defaultDurationMinutes: 90, isPublic: false }),
      ),
    ).rejects.toThrow(/not permitted/i);
  });

  it("generates upcoming occurrences from the recurrence rule, idempotently", async () => {
    const tenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const first = await withTenantContext(appDb, tenant, (tx) =>
      servicesService.generateOccurrences(tx, tenant, teamAId, serviceId, 3),
    );
    expect(first).toHaveLength(3);
    occurrenceId = first[0]!.id;

    // Re-running with a larger count only inserts the *new* ones —
    // proves the (serviceId, occursAt) unique constraint is doing its job.
    const second = await withTenantContext(appDb, tenant, (tx) =>
      servicesService.generateOccurrences(tx, tenant, teamAId, serviceId, 5),
    );
    expect(second).toHaveLength(2);
  });

  it("opening a plan for an occurrence auto-creates a draft the first time, and is stable after", async () => {
    const tenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const first = await withTenantContext(appDb, tenant, (tx) =>
      plansService.getOrCreatePlanForOccurrence(tx, tenant, occurrenceId),
    );
    expect(first?.status).toBe("draft");
    planId = first!.id;

    const second = await withTenantContext(appDb, tenant, (tx) =>
      plansService.getOrCreatePlanForOccurrence(tx, tenant, occurrenceId),
    );
    expect(second?.id).toBe(planId);
  });

  it("a team_member can read the plan but cannot edit it", async () => {
    const memberTenant = tenantFor(orgId, memberUserId, "team_member");
    const detail = await withTenantContext(appDb, memberTenant, (tx) =>
      plansService.getPlanDetail(tx, orgId, planId),
    );
    expect(detail?.id).toBe(planId);

    await expect(
      withTenantContext(appDb, memberTenant, (tx) => plansService.updatePlan(tx, memberTenant, planId, { title: "Nope" })),
    ).rejects.toThrow(/not permitted/i);
  });

  it("builds out the plan: a guest speaker, a song with an assignment, and an announcement", async () => {
    const tenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);

    const speaker = await withTenantContext(appDb, tenant, (tx) =>
      plansService.addSpeaker(tx, tenant, planId, {
        guestFirstName: "Guest",
        guestLastName: "Preacher",
        roleLabel: "Preaching",
        sermonTitle: "On Community",
        order: 0,
      }),
    );
    expect(speaker?.roleLabel).toBe("Preaching");

    const song = await withTenantContext(appDb, tenant, (tx) => songsService.createSong(tx, orgId, { title: "Amazing Grace" }));
    songId = song.id;

    const planSong = await withTenantContext(appDb, tenant, (tx) =>
      plansService.addSongToPlan(tx, tenant, planId, { songId, order: 0 }),
    );
    planSongId = planSong!.id;

    const assignment = await withTenantContext(appDb, tenant, (tx) =>
      plansService.assignSongPerson(tx, tenant, planId, planSongId, {
        personId: leaderPersonId,
        instrumentOrRole: "Acoustic Guitar",
      }),
    );
    expect(assignment?.instrumentOrRole).toBe("Acoustic Guitar");

    const announcement = await withTenantContext(appDb, tenant, (tx) =>
      plansService.addAnnouncement(tx, tenant, planId, { title: "Potluck", content: "Bring a dish!", order: 0 }),
    );
    expect(announcement?.title).toBe("Potluck");
  });

  it("org_admin defines a serving role; the team leader fills it in on the plan", async () => {
    const adminTenant = tenantFor(orgId, orgAdminUserId, "org_admin");
    const role = await withTenantContext(appDb, adminTenant, (tx) =>
      servingRolesService.createServingRole(tx, orgId, { name: "Sound Tech" }),
    );
    servingRoleId = role.id;

    const leaderTenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const assignment = await withTenantContext(appDb, leaderTenant, (tx) =>
      plansService.addRoleAssignment(tx, leaderTenant, planId, { servingRoleId, personId: leaderPersonId }),
    );
    expect(assignment?.status).toBe("invited");
    roleAssignmentId = assignment!.id;
  });

  it("the assignee can confirm their own assignment without team-leader rights", async () => {
    // leaderOfTeamIds is deliberately empty here, so canEditAsLeader is
    // false — the only way this can succeed is the self-service branch
    // in updateRoleAssignmentStatus, which checks the assignment's
    // personId against a `people` row linked to the caller's own
    // account (leaderPersonId → leaderUserId). Proves the confirm/
    // decline path works off that linkage, not off team-leader rights.
    const tenant = tenantFor(orgId, leaderUserId, "team_leader", []);
    const updated = await withTenantContext(appDb, tenant, (tx) =>
      plansService.updateRoleAssignmentStatus(tx, tenant, planId, roleAssignmentId, { status: "confirmed" }),
    );
    expect(updated?.status).toBe("confirmed");
  });

  it("publishing the plan flips its status", async () => {
    const tenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const published = await withTenantContext(appDb, tenant, (tx) => plansService.publishPlan(tx, tenant, planId));
    expect(published?.status).toBe("published");
  });

  it("listMyAssignments surfaces the confirmed assignment for the linked person's user", async () => {
    const tenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const mine = await withTenantContext(appDb, tenant, (tx) => plansService.listMyAssignments(tx, tenant));
    expect(mine.some((a) => a.id === roleAssignmentId)).toBe(true);
  });

  it("cross-tenant: a second org's team leader cannot see or touch the first org's service", async () => {
    const suffix = randomUUID().slice(0, 8);
    const [otherOrg] = await systemDb
      .insert(schema.organizations)
      .values({ name: `Other Org ${suffix}`, slug: `other-org-${suffix}` })
      .returning();
    const [otherTeam] = await systemDb
      .insert(schema.teams)
      .values({ organizationId: otherOrg!.id, name: "Other Team" })
      .returning();
    const [otherUser] = await systemDb
      .insert(schema.users)
      .values({ authProviderId: `sched-test|other-${suffix}`, email: `other-${suffix}@sched-test.example` })
      .returning();
    await systemDb.insert(schema.organizationMembers).values({
      organizationId: otherOrg!.id,
      userId: otherUser!.id,
      role: "team_leader",
      status: "active",
    });
    await systemDb
      .insert(schema.teamMembers)
      .values({ organizationId: otherOrg!.id, teamId: otherTeam!.id, userId: otherUser!.id, role: "leader" });

    const otherTenant = tenantFor(otherOrg!.id, otherUser!.id, "team_leader", [otherTeam!.id]);
    const rows = await withTenantContext(appDb, otherTenant, (tx) =>
      tx.select().from(schema.services).where(eq(schema.services.id, serviceId)),
    );
    expect(rows).toHaveLength(0);

    await systemDb.delete(schema.organizations).where(eq(schema.organizations.id, otherOrg!.id));
  });
});
