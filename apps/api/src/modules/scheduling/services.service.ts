import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { canOne } from "@pylr/auth";
import { and, eq, schema } from "@pylr/db";
import type { Database } from "@pylr/db";
import type { CreateServiceInput, UpdateServiceInput } from "@pylr/schemas";
import type { TenantScopedRequest } from "../../common/guards/request.types";
import { insertPendingBookingRequest } from "../booking/booking-request.util";
import { computeUpcomingOccurrences } from "./recurrence";

@Injectable()
export class ServicesService {
  async listServices(tx: Database, organizationId: string, teamId: string) {
    return tx.query.services.findMany({
      where: and(eq(schema.services.organizationId, organizationId), eq(schema.services.teamId, teamId)),
      orderBy: (s, { asc }) => [asc(s.name)],
    });
  }

  async getService(tx: Database, organizationId: string, teamId: string, serviceId: string) {
    const service = await tx.query.services.findFirst({
      where: and(
        eq(schema.services.id, serviceId),
        eq(schema.services.organizationId, organizationId),
        eq(schema.services.teamId, teamId),
      ),
    });
    if (!service) throw new NotFoundException("Service not found");
    return service;
  }

  /**
   * The interceptor-level `@CheckAbility` only confirms the caller has
   * *some* "create Service" rule (org_admin, or a team_leader for at
   * least one team); this is the precise, per-record check — a
   * team_leader may only create services for a team they actually lead.
   */
  async createService(tx: Database, tenant: TenantScopedRequest["tenant"], teamId: string, input: CreateServiceInput) {
    if (!canOne(tenant.ability, "create", "Service", { teamId })) {
      throw new ForbiddenException("Not permitted to create services for this team");
    }
    const [service] = await tx
      .insert(schema.services)
      .values({ organizationId: tenant.organizationId, teamId, ...input })
      .returning();
    if (!service) throw new Error("Service insert returned no row");
    return service;
  }

  async updateService(
    tx: Database,
    tenant: TenantScopedRequest["tenant"],
    teamId: string,
    serviceId: string,
    input: UpdateServiceInput,
  ) {
    const service = await this.getService(tx, tenant.organizationId, teamId, serviceId);
    if (!canOne(tenant.ability, "update", "Service", { teamId: service.teamId })) {
      throw new ForbiddenException("Not permitted to update this service");
    }
    const [updated] = await tx
      .update(schema.services)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schema.services.id, service.id))
      .returning();
    return updated;
  }

  async deleteService(tx: Database, tenant: TenantScopedRequest["tenant"], teamId: string, serviceId: string) {
    const service = await this.getService(tx, tenant.organizationId, teamId, serviceId);
    if (!canOne(tenant.ability, "delete", "Service", { teamId: service.teamId })) {
      throw new ForbiddenException("Not permitted to delete this service");
    }
    await tx.delete(schema.services).where(eq(schema.services.id, service.id));
  }

  async listOccurrences(tx: Database, organizationId: string, teamId: string, serviceId: string) {
    await this.getService(tx, organizationId, teamId, serviceId);
    return tx.query.serviceOccurrences.findMany({
      where: eq(schema.serviceOccurrences.serviceId, serviceId),
      orderBy: (o, { asc }) => [asc(o.occursAt)],
    });
  }

  /**
   * Generates the next `count` occurrences from the service's
   * recurrence rule (see recurrence.ts for the current simplifications).
   * Safe to call repeatedly — already-generated occurrences are skipped
   * via the (serviceId, occursAt) unique constraint rather than
   * duplicated.
   */
  async generateOccurrences(
    tx: Database,
    tenant: TenantScopedRequest["tenant"],
    teamId: string,
    serviceId: string,
    count: number,
  ) {
    const service = await this.getService(tx, tenant.organizationId, teamId, serviceId);
    if (!canOne(tenant.ability, "update", "Service", { teamId: service.teamId })) {
      throw new ForbiddenException("Not permitted to schedule occurrences for this service");
    }
    if (!service.recurrenceRule || !service.defaultTime) {
      throw new ForbiddenException(
        "Service needs both a recurrenceRule and defaultTime set before occurrences can be generated",
      );
    }

    const occursAtList = computeUpcomingOccurrences(service.recurrenceRule, service.defaultTime, count);
    const rows = await tx
      .insert(schema.serviceOccurrences)
      .values(
        occursAtList.map((occursAt) => ({
          organizationId: tenant.organizationId,
          serviceId: service.id,
          teamId: service.teamId,
          occursAt,
          durationMinutes: service.defaultDurationMinutes,
          resourceId: service.defaultResourceId,
        })),
      )
      .onConflictDoNothing({ target: [schema.serviceOccurrences.serviceId, schema.serviceOccurrences.occursAt] })
      .returning();

    // A service with a default room claims it through the same
    // pending-approval queue any ad-hoc booking goes through — no
    // bypass, even though the requester already has edit rights on the
    // service (Phase 2 decision: one approval path everywhere).
    if (service.defaultResourceId) {
      for (const occurrence of rows) {
        await insertPendingBookingRequest(tx, {
          organizationId: tenant.organizationId,
          requestingTeamId: service.teamId,
          resourceId: service.defaultResourceId,
          startsAt: occurrence.occursAt,
          endsAt: new Date(occurrence.occursAt.getTime() + occurrence.durationMinutes * 60_000),
          purpose: `${service.name} (recurring)`,
          relatedServiceOccurrenceId: occurrence.id,
          requestedByUserId: tenant.userId,
        });
      }
    }
    return rows;
  }
}
