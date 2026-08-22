import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { canOne } from "@pylr/auth";
import { and, eq, schema } from "@pylr/db";
import type { Database } from "@pylr/db";
import { BOOKING_REQUEST_STATUSES } from "@pylr/schemas";
import type { BookingRequestStatus, CreateBookingRequestInput, ResubmitBookingRequestInput } from "@pylr/schemas";
import type { TenantScopedRequest } from "../../common/guards/request.types";
import { insertPendingBookingRequest, pgErrorCode } from "./booking-request.util";

type Tenant = TenantScopedRequest["tenant"];

export interface BookingRequestFilters {
  status?: BookingRequestStatus;
  teamId?: string;
  resourceId?: string;
}

@Injectable()
export class BookingRequestsService {
  /**
   * Org-wide list (the approvals queue / calendar feed), optionally
   * narrowed by query filters. No role-based scoping beyond the coarse
   * "read BookingRequest" ability check on the route — team_leader and
   * team_member both hold an unconditioned read grant, the same
   * "everyone in the org can see the schedule, only certain roles can
   * change it" shape Service/Plan already use in Phase 1.
   */
  async listBookingRequests(tx: Database, organizationId: string, filters: BookingRequestFilters) {
    // Guard against an invalid ?status= value reaching Postgres as an
    // enum comparison (which would 500 rather than just yield no rows) —
    // an unrecognized value is treated as "no filter" instead.
    const status =
      filters.status && (BOOKING_REQUEST_STATUSES as readonly string[]).includes(filters.status)
        ? filters.status
        : undefined;
    return tx.query.bookingRequests.findMany({
      where: and(
        eq(schema.bookingRequests.organizationId, organizationId),
        status ? eq(schema.bookingRequests.status, status) : undefined,
        filters.teamId ? eq(schema.bookingRequests.requestingTeamId, filters.teamId) : undefined,
        filters.resourceId ? eq(schema.bookingRequests.resourceId, filters.resourceId) : undefined,
      ),
      orderBy: (b, { asc }) => [asc(b.startsAt)],
    });
  }

  /** "My bookings" — every request the current user submitted, any status. */
  async listMyBookingRequests(tx: Database, tenant: Tenant) {
    return tx.query.bookingRequests.findMany({
      where: and(
        eq(schema.bookingRequests.organizationId, tenant.organizationId),
        eq(schema.bookingRequests.requestedByUserId, tenant.userId),
      ),
      orderBy: (b, { asc }) => [asc(b.startsAt)],
    });
  }

  async getBookingRequest(tx: Database, organizationId: string, id: string) {
    const br = await tx.query.bookingRequests.findFirst({
      where: and(eq(schema.bookingRequests.id, id), eq(schema.bookingRequests.organizationId, organizationId)),
    });
    if (!br) throw new NotFoundException("Booking request not found");
    return br;
  }

  async createBookingRequest(tx: Database, tenant: Tenant, input: CreateBookingRequestInput) {
    if (!canOne(tenant.ability, "create", "BookingRequest", { requestingTeamId: input.requestingTeamId })) {
      throw new ForbiddenException("Not permitted to submit bookings for this team");
    }
    const resource = await tx.query.resources.findFirst({
      where: and(eq(schema.resources.id, input.resourceId), eq(schema.resources.organizationId, tenant.organizationId)),
    });
    if (!resource) throw new NotFoundException("Resource not found");

    // Always lands as `pending` — one approval path for every booking,
    // ad-hoc or generated from a service occurrence (see
    // ServicesService.generateOccurrences, which calls the same
    // insertPendingBookingRequest helper).
    return insertPendingBookingRequest(tx, {
      organizationId: tenant.organizationId,
      requestingTeamId: input.requestingTeamId,
      resourceId: input.resourceId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      purpose: input.purpose,
      relatedServiceOccurrenceId: input.relatedServiceOccurrenceId,
      requestedByUserId: tenant.userId,
    });
  }

  // --- State machine ---------------------------------------------------
  //
  // pending -> approved | denied | changes_requested
  // changes_requested -> pending          (resubmit)
  // pending | changes_requested -> cancelled   (requester withdraws)
  // approved -> cancelled                 (org_admin revoke only)
  //
  // Every transition goes through transitionStatus, hardened two ways
  // against the concurrent-approval race docs/ARCHITECTURE.md calls out:
  //  1. App layer: `UPDATE ... WHERE id = $1 AND status = $2 RETURNING *`.
  //     Zero rows back means someone else already actioned this exact row
  //     — cheap, and gives a clean "already actioned" 409 before ever
  //     reaching the DB constraint.
  //  2. DB layer: the `no_overlapping_approved_bookings` exclusion
  //     constraint (migrations/0006_booking_rls.sql) is what actually
  //     rejects two *different* rows racing to approve overlapping
  //     bookings for the same resource — the app-layer guard alone can't
  //     see that, since both rows are legitimately `pending` going in.
  //     See apps/api/test/booking.test.ts's concurrency test.
  private async transitionStatus(
    tx: Database,
    id: string,
    organizationId: string,
    fromStatus: BookingRequestStatus,
    toStatus: BookingRequestStatus,
    extra: Record<string, unknown> = {},
  ) {
    let updated;
    try {
      [updated] = await tx
        .update(schema.bookingRequests)
        .set({ status: toStatus, updatedAt: new Date(), ...extra })
        .where(
          and(
            eq(schema.bookingRequests.id, id),
            eq(schema.bookingRequests.organizationId, organizationId),
            eq(schema.bookingRequests.status, fromStatus),
          ),
        )
        .returning();
    } catch (err) {
      // 23P01 = exclusion_violation — the DB-layer backstop caught a
      // genuine double-booking of the same resource/time by a concurrent
      // approval.
      if (pgErrorCode(err) === "23P01") {
        throw new ConflictException("This resource is already booked for an overlapping approved time");
      }
      throw err;
    }
    if (!updated) {
      const current = await tx.query.bookingRequests.findFirst({
        where: and(eq(schema.bookingRequests.id, id), eq(schema.bookingRequests.organizationId, organizationId)),
      });
      if (!current) throw new NotFoundException("Booking request not found");
      throw new ConflictException(`Booking request is no longer ${fromStatus} (now ${current.status})`);
    }
    return updated;
  }

  // No canOne here: only org_admin's "manage all" grants the "approve"
  // action at all, so the @CheckAbility("approve", "BookingRequest") gate
  // on the controller is already the complete authorization check.
  async approve(tx: Database, tenant: Tenant, id: string) {
    await this.getBookingRequest(tx, tenant.organizationId, id); // 404s if missing/wrong org
    return this.transitionStatus(tx, id, tenant.organizationId, "pending", "approved", {
      reviewedByUserId: tenant.userId,
    });
  }

  async deny(tx: Database, tenant: Tenant, id: string, reviewNote?: string) {
    await this.getBookingRequest(tx, tenant.organizationId, id);
    return this.transitionStatus(tx, id, tenant.organizationId, "pending", "denied", {
      reviewedByUserId: tenant.userId,
      reviewNote,
    });
  }

  async requestChanges(tx: Database, tenant: Tenant, id: string, reviewNote?: string) {
    await this.getBookingRequest(tx, tenant.organizationId, id);
    return this.transitionStatus(tx, id, tenant.organizationId, "pending", "changes_requested", {
      reviewedByUserId: tenant.userId,
      reviewNote,
    });
  }

  /** Requester (their own team's leader) resubmits after changes_requested — loops back to pending. */
  async resubmit(tx: Database, tenant: Tenant, id: string, input: ResubmitBookingRequestInput) {
    const br = await this.getBookingRequest(tx, tenant.organizationId, id);
    this.requireOwnerOrAdmin(tenant, br);
    return this.transitionStatus(tx, id, tenant.organizationId, "changes_requested", "pending", {
      ...(input.startsAt ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt ? { endsAt: input.endsAt } : {}),
      ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
      reviewNote: null,
    });
  }

  /** Withdraw (requester, from pending/changes_requested) or revoke (org_admin, from approved too). */
  async cancel(tx: Database, tenant: Tenant, id: string) {
    const br = await this.getBookingRequest(tx, tenant.organizationId, id);
    if (br.status === "approved" && tenant.role !== "org_admin") {
      throw new ForbiddenException("Only an org admin can revoke an approved booking");
    }
    this.requireOwnerOrAdmin(tenant, br);
    return this.transitionStatus(tx, id, tenant.organizationId, br.status, "cancelled");
  }

  private requireOwnerOrAdmin(tenant: Tenant, br: { requestingTeamId: string }) {
    if (tenant.role === "org_admin") return;
    if (!canOne(tenant.ability, "update", "BookingRequest", { requestingTeamId: br.requestingTeamId })) {
      throw new ForbiddenException("Not permitted to modify this booking request");
    }
  }
}
