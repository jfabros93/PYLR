import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createDb, eq, schema, withTenantContext, type Database } from "@pylr/db";
import { defineAbilityFor } from "@pylr/auth";
import type { OrgRole } from "@pylr/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BookingRequestsService } from "../src/modules/booking/booking-requests.service";
import { ResourcesService } from "../src/modules/booking/resources.service";
import { ServicesService } from "../src/modules/scheduling/services.service";

/**
 * Exercises Phase 2's event planner — resource CRUD, the booking_requests
 * state machine, and the exclusion-constraint conflict prevention this
 * phase is built around — against a real Postgres instance running the
 * actual migrations, the same way apps/api/test/scheduling.test.ts proved
 * Phase 1. This connects as `pylr_app`, so every query here is genuinely
 * RLS-enforced, not just app-code-correct — and the concurrency tests are
 * genuine DB-level races, not simulated (see the comment on the first one).
 */

const APP_URL = process.env.DATABASE_URL_APP;
const SYSTEM_URL = process.env.DATABASE_URL_SYSTEM;
if (!APP_URL || !SYSTEM_URL) {
  throw new Error("DATABASE_URL_APP / DATABASE_URL_SYSTEM must be set — see docs/LOCAL_DEV.md");
}

const appDb: Database = createDb(APP_URL);
const systemDb: Database = createDb(SYSTEM_URL);

const resourcesService = new ResourcesService();
const bookingRequestsService = new BookingRequestsService();
const servicesService = new ServicesService();

function tenantFor(organizationId: string, userId: string, role: OrgRole, leaderOfTeamIds: string[] = []) {
  return { organizationId, userId, role, ability: defineAbilityFor({ organizationId, role, leaderOfTeamIds }) };
}

let slotCounter = 0;
/**
 * Returns a fresh, hour-long window on its own calendar day, so unrelated
 * tests never accidentally collide against the real exclusion constraint
 * — only tests that deliberately reuse the same slot are meant to race.
 */
function nextSlot() {
  slotCounter += 1;
  const startsAt = new Date(Date.now() + slotCounter * 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  return { startsAt, endsAt };
}

let orgId: string;
let teamAId: string; // led by leaderUserId
let teamBId: string; // led by leaderBUserId
let orgAdminUserId: string;
let leaderUserId: string;
let leaderBUserId: string;
let memberUserId: string;
let resourceId: string;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);

  const [org] = await systemDb
    .insert(schema.organizations)
    .values({ name: `Booking Test Org ${suffix}`, slug: `booking-test-${suffix}` })
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
    .values({ authProviderId: `booking-test|admin-${suffix}`, email: `admin-${suffix}@booking-test.example` })
    .returning();
  const [leader] = await systemDb
    .insert(schema.users)
    .values({ authProviderId: `booking-test|leader-${suffix}`, email: `leader-${suffix}@booking-test.example` })
    .returning();
  const [leaderB] = await systemDb
    .insert(schema.users)
    .values({ authProviderId: `booking-test|leaderb-${suffix}`, email: `leaderb-${suffix}@booking-test.example` })
    .returning();
  const [member] = await systemDb
    .insert(schema.users)
    .values({ authProviderId: `booking-test|member-${suffix}`, email: `member-${suffix}@booking-test.example` })
    .returning();
  if (!admin || !leader || !leaderB || !member) throw new Error("user insert failed");
  orgAdminUserId = admin.id;
  leaderUserId = leader.id;
  leaderBUserId = leaderB.id;
  memberUserId = member.id;

  await systemDb.insert(schema.organizationMembers).values([
    { organizationId: orgId, userId: orgAdminUserId, role: "org_admin", status: "active" },
    { organizationId: orgId, userId: leaderUserId, role: "team_leader", status: "active" },
    { organizationId: orgId, userId: leaderBUserId, role: "team_leader", status: "active" },
    { organizationId: orgId, userId: memberUserId, role: "team_member", status: "active" },
  ]);
  await systemDb.insert(schema.teamMembers).values([
    { organizationId: orgId, teamId: teamAId, userId: leaderUserId, role: "leader" },
    { organizationId: orgId, teamId: teamBId, userId: leaderBUserId, role: "leader" },
  ]);
});

afterAll(async () => {
  await systemDb.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
});

describe("booking module (Phase 2, RLS-enforced via pylr_app)", () => {
  let bookingAId: string;

  it("org_admin creates a resource", async () => {
    const tenant = tenantFor(orgId, orgAdminUserId, "org_admin");
    const resource = await withTenantContext(appDb, tenant, (tx) =>
      resourcesService.createResource(tx, orgId, { name: "Sanctuary", type: "room", requiresApproval: true }),
    );
    expect(resource.name).toBe("Sanctuary");
    resourceId = resource.id;
  });

  it("a team leader can submit a booking request for their own team", async () => {
    const tenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const { startsAt, endsAt } = nextSlot();
    const booking = await withTenantContext(appDb, tenant, (tx) =>
      bookingRequestsService.createBookingRequest(tx, tenant, {
        requestingTeamId: teamAId,
        resourceId,
        startsAt,
        endsAt,
        purpose: "Sunday service",
      }),
    );
    expect(booking.status).toBe("pending");
    bookingAId = booking.id;
  });

  it("the same leader is rejected submitting a booking for a team they don't lead", async () => {
    const tenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const { startsAt, endsAt } = nextSlot();
    await expect(
      withTenantContext(appDb, tenant, (tx) =>
        bookingRequestsService.createBookingRequest(tx, tenant, { requestingTeamId: teamBId, resourceId, startsAt, endsAt }),
      ),
    ).rejects.toThrow(/not permitted/i);
  });

  it("a team_member cannot submit a booking request at all", async () => {
    const tenant = tenantFor(orgId, memberUserId, "team_member");
    const { startsAt, endsAt } = nextSlot();
    await expect(
      withTenantContext(appDb, tenant, (tx) =>
        bookingRequestsService.createBookingRequest(tx, tenant, { requestingTeamId: teamAId, resourceId, startsAt, endsAt }),
      ),
    ).rejects.toThrow(/not permitted/i);
  });

  it("two pending bookings for the same resource and overlapping time both succeed", async () => {
    const tenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const { startsAt, endsAt } = nextSlot();
    const b1 = await withTenantContext(appDb, tenant, (tx) =>
      bookingRequestsService.createBookingRequest(tx, tenant, { requestingTeamId: teamAId, resourceId, startsAt, endsAt }),
    );
    const b2 = await withTenantContext(appDb, tenant, (tx) =>
      bookingRequestsService.createBookingRequest(tx, tenant, { requestingTeamId: teamAId, resourceId, startsAt, endsAt }),
    );
    expect(b1.status).toBe("pending");
    expect(b2.status).toBe("pending");
  });

  it("org_admin approves a pending booking", async () => {
    const tenant = tenantFor(orgId, orgAdminUserId, "org_admin");
    const approved = await withTenantContext(appDb, tenant, (tx) => bookingRequestsService.approve(tx, tenant, bookingAId));
    expect(approved.status).toBe("approved");
    expect(approved.reviewedByUserId).toBe(orgAdminUserId);
  });

  it("only org_admin's ability grants approve on a BookingRequest — team_leader/team_member never get it", () => {
    // approve/deny/request-changes have no per-record canOne check in the
    // service (see booking-requests.service.ts) — only org_admin's
    // "manage all" ever grants the "approve" action at all, so the coarse
    // @CheckAbility("approve", "BookingRequest") gate at the route is the
    // complete authorization check, the same shape ServingRolesService
    // relies on for role creation. This asserts that gate directly.
    const leaderTenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const memberTenant = tenantFor(orgId, memberUserId, "team_member");
    const adminTenant = tenantFor(orgId, orgAdminUserId, "org_admin");
    expect(leaderTenant.ability.can("approve", "BookingRequest")).toBe(false);
    expect(memberTenant.ability.can("approve", "BookingRequest")).toBe(false);
    expect(adminTenant.ability.can("approve", "BookingRequest")).toBe(true);
  });

  it("denying a pending booking records the review note", async () => {
    const leaderTenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const { startsAt, endsAt } = nextSlot();
    const booking = await withTenantContext(appDb, leaderTenant, (tx) =>
      bookingRequestsService.createBookingRequest(tx, leaderTenant, { requestingTeamId: teamAId, resourceId, startsAt, endsAt }),
    );

    const adminTenant = tenantFor(orgId, orgAdminUserId, "org_admin");
    const denied = await withTenantContext(appDb, adminTenant, (tx) =>
      bookingRequestsService.deny(tx, adminTenant, booking.id, "Room is being renovated that week"),
    );
    expect(denied.status).toBe("denied");
    expect(denied.reviewNote).toBe("Room is being renovated that week");
  });

  it("request-changes loops back to pending on resubmit, then can be approved", async () => {
    const leaderTenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const { startsAt, endsAt } = nextSlot();
    const booking = await withTenantContext(appDb, leaderTenant, (tx) =>
      bookingRequestsService.createBookingRequest(tx, leaderTenant, {
        requestingTeamId: teamAId,
        resourceId,
        startsAt,
        endsAt,
        purpose: "Youth event",
      }),
    );

    const adminTenant = tenantFor(orgId, orgAdminUserId, "org_admin");
    const changesRequested = await withTenantContext(appDb, adminTenant, (tx) =>
      bookingRequestsService.requestChanges(tx, adminTenant, booking.id, "Can you move it an hour later?"),
    );
    expect(changesRequested.status).toBe("changes_requested");

    const nextWindow = nextSlot();
    const resubmitted = await withTenantContext(appDb, leaderTenant, (tx) =>
      bookingRequestsService.resubmit(tx, leaderTenant, booking.id, {
        startsAt: nextWindow.startsAt,
        endsAt: nextWindow.endsAt,
      }),
    );
    expect(resubmitted.status).toBe("pending");
    expect(resubmitted.reviewNote).toBeNull();
    expect(resubmitted.startsAt.getTime()).toBe(nextWindow.startsAt.getTime());

    const approved = await withTenantContext(appDb, adminTenant, (tx) => bookingRequestsService.approve(tx, adminTenant, booking.id));
    expect(approved.status).toBe("approved");
  });

  it("a leader from a different team cannot resubmit or cancel someone else's booking", async () => {
    const leaderTenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const { startsAt, endsAt } = nextSlot();
    const booking = await withTenantContext(appDb, leaderTenant, (tx) =>
      bookingRequestsService.createBookingRequest(tx, leaderTenant, { requestingTeamId: teamAId, resourceId, startsAt, endsAt }),
    );

    const adminTenant = tenantFor(orgId, orgAdminUserId, "org_admin");
    await withTenantContext(appDb, adminTenant, (tx) => bookingRequestsService.requestChanges(tx, adminTenant, booking.id));

    const leaderBTenant = tenantFor(orgId, leaderBUserId, "team_leader", [teamBId]);
    await expect(
      withTenantContext(appDb, leaderBTenant, (tx) => bookingRequestsService.resubmit(tx, leaderBTenant, booking.id, {})),
    ).rejects.toThrow(/not permitted/i);
    await expect(
      withTenantContext(appDb, leaderBTenant, (tx) => bookingRequestsService.cancel(tx, leaderBTenant, booking.id)),
    ).rejects.toThrow(/not permitted/i);
  });

  it("the requester can withdraw their own pending booking", async () => {
    const leaderTenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const { startsAt, endsAt } = nextSlot();
    const booking = await withTenantContext(appDb, leaderTenant, (tx) =>
      bookingRequestsService.createBookingRequest(tx, leaderTenant, { requestingTeamId: teamAId, resourceId, startsAt, endsAt }),
    );
    const cancelled = await withTenantContext(appDb, leaderTenant, (tx) => bookingRequestsService.cancel(tx, leaderTenant, booking.id));
    expect(cancelled.status).toBe("cancelled");
  });

  it("only an org_admin can revoke an approved booking", async () => {
    const leaderTenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const { startsAt, endsAt } = nextSlot();
    const booking = await withTenantContext(appDb, leaderTenant, (tx) =>
      bookingRequestsService.createBookingRequest(tx, leaderTenant, { requestingTeamId: teamAId, resourceId, startsAt, endsAt }),
    );
    const adminTenant = tenantFor(orgId, orgAdminUserId, "org_admin");
    await withTenantContext(appDb, adminTenant, (tx) => bookingRequestsService.approve(tx, adminTenant, booking.id));

    await expect(
      withTenantContext(appDb, leaderTenant, (tx) => bookingRequestsService.cancel(tx, leaderTenant, booking.id)),
    ).rejects.toThrow(/only an org admin/i);

    const revoked = await withTenantContext(appDb, adminTenant, (tx) => bookingRequestsService.cancel(tx, adminTenant, booking.id));
    expect(revoked.status).toBe("cancelled");
  });

  it("concurrent approvals of two DIFFERENT overlapping pending bookings for the same resource: exactly one succeeds", async () => {
    // Because withTenantContext opens a fresh pooled Postgres
    // connection/transaction per call, firing two via Promise.allSettled
    // is genuine DB-level concurrency, not simulated — Postgres's own
    // locking on the exclusion constraint's GiST index serializes the two
    // UPDATEs, and the second to actually commit hits
    // no_overlapping_approved_bookings.
    const leaderTenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const { startsAt, endsAt } = nextSlot();
    const b1 = await withTenantContext(appDb, leaderTenant, (tx) =>
      bookingRequestsService.createBookingRequest(tx, leaderTenant, { requestingTeamId: teamAId, resourceId, startsAt, endsAt }),
    );
    const b2 = await withTenantContext(appDb, leaderTenant, (tx) =>
      bookingRequestsService.createBookingRequest(tx, leaderTenant, { requestingTeamId: teamAId, resourceId, startsAt, endsAt }),
    );

    const adminTenant = tenantFor(orgId, orgAdminUserId, "org_admin");
    const results = await Promise.allSettled([
      withTenantContext(appDb, adminTenant, (tx) => bookingRequestsService.approve(tx, adminTenant, b1.id)),
      withTenantContext(appDb, adminTenant, (tx) => bookingRequestsService.approve(tx, adminTenant, b2.id)),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason.message).toMatch(/already booked|overlapping/i);

    const winnerId = fulfilled[0]!.value.id;
    const loserId = winnerId === b1.id ? b2.id : b1.id;
    const loser = await withTenantContext(appDb, adminTenant, (tx) => bookingRequestsService.getBookingRequest(tx, orgId, loserId));
    expect(loser.status).toBe("pending"); // untouched, not silently flipped
  });

  it("concurrent approvals of the SAME pending booking: exactly one succeeds, the other gets an already-actioned error", async () => {
    const leaderTenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const { startsAt, endsAt } = nextSlot();
    const booking = await withTenantContext(appDb, leaderTenant, (tx) =>
      bookingRequestsService.createBookingRequest(tx, leaderTenant, { requestingTeamId: teamAId, resourceId, startsAt, endsAt }),
    );

    const adminTenant = tenantFor(orgId, orgAdminUserId, "org_admin");
    const results = await Promise.allSettled([
      withTenantContext(appDb, adminTenant, (tx) => bookingRequestsService.approve(tx, adminTenant, booking.id)),
      withTenantContext(appDb, adminTenant, (tx) => bookingRequestsService.approve(tx, adminTenant, booking.id)),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // The app-layer WHERE-status guard in transitionStatus is what fires
    // here, not the exclusion constraint — same row, so no range overlap
    // to detect; the second UPDATE just matches zero rows once the first commits.
    expect(rejected[0]!.reason.message).toMatch(/no longer pending/i);
  });

  it("listMyBookingRequests surfaces everything the leader submitted", async () => {
    const leaderTenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const mine = await withTenantContext(appDb, leaderTenant, (tx) => bookingRequestsService.listMyBookingRequests(tx, leaderTenant));
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((b) => b.requestedByUserId === leaderUserId)).toBe(true);
  });

  it("a service with a defaultResourceId generates occurrences that reserve the room through the normal pending queue", async () => {
    const adminTenant = tenantFor(orgId, orgAdminUserId, "org_admin");
    const youthRoom = await withTenantContext(appDb, adminTenant, (tx) =>
      resourcesService.createResource(tx, orgId, { name: "Youth Room", type: "room", requiresApproval: true }),
    );

    const leaderTenant = tenantFor(orgId, leaderUserId, "team_leader", [teamAId]);
    const service = await withTenantContext(appDb, leaderTenant, (tx) =>
      servicesService.createService(tx, leaderTenant, teamAId, {
        name: "Wednesday Youth Night",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=WE",
        defaultTime: "19:00",
        defaultDurationMinutes: 60,
        isPublic: false,
        defaultResourceId: youthRoom.id,
      }),
    );

    const occurrences = await withTenantContext(appDb, leaderTenant, (tx) =>
      servicesService.generateOccurrences(tx, leaderTenant, teamAId, service.id, 2),
    );
    expect(occurrences).toHaveLength(2);
    expect(occurrences.every((o) => o.resourceId === youthRoom.id)).toBe(true);

    // No approval bypass — each occurrence's room reservation is a
    // normal `pending` booking_requests row, same as an ad-hoc
    // submission, per the Phase 2 decision to keep one approval path
    // everywhere (no auto-approve just because the requester already has
    // edit rights on the service).
    const bookings = await withTenantContext(appDb, leaderTenant, (tx) =>
      bookingRequestsService.listBookingRequests(tx, orgId, { resourceId: youthRoom.id }),
    );
    expect(bookings).toHaveLength(2);
    expect(bookings.every((b) => b.status === "pending")).toBe(true);
    expect(
      bookings.every((b) => b.relatedServiceOccurrenceId && occurrences.some((o) => o.id === b.relatedServiceOccurrenceId)),
    ).toBe(true);
  });

  it("cross-tenant: a second org cannot see or touch the first org's booking requests", async () => {
    const suffix = randomUUID().slice(0, 8);
    const [otherOrg] = await systemDb
      .insert(schema.organizations)
      .values({ name: `Other Booking Org ${suffix}`, slug: `other-booking-org-${suffix}` })
      .returning();
    const [otherUser] = await systemDb
      .insert(schema.users)
      .values({ authProviderId: `booking-test|other-${suffix}`, email: `other-${suffix}@booking-test.example` })
      .returning();
    await systemDb
      .insert(schema.organizationMembers)
      .values({ organizationId: otherOrg!.id, userId: otherUser!.id, role: "org_admin", status: "active" });

    const otherTenant = tenantFor(otherOrg!.id, otherUser!.id, "org_admin");
    const rows = await withTenantContext(appDb, otherTenant, (tx) =>
      tx.select().from(schema.bookingRequests).where(eq(schema.bookingRequests.id, bookingAId)),
    );
    expect(rows).toHaveLength(0);

    await systemDb.delete(schema.organizations).where(eq(schema.organizations.id, otherOrg!.id));
  });
});
