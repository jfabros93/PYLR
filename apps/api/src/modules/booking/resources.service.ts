import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, gt, lt, or, schema } from "@pylr/db";
import type { Database } from "@pylr/db";
import type { CreateResourceInput, UpdateResourceInput } from "@pylr/schemas";
import { pgErrorCode } from "./booking-request.util";

@Injectable()
export class ResourcesService {
  async listResources(tx: Database, organizationId: string) {
    return tx.query.resources.findMany({
      where: eq(schema.resources.organizationId, organizationId),
      orderBy: (r, { asc }) => [asc(r.name)],
    });
  }

  async getResource(tx: Database, organizationId: string, resourceId: string) {
    const resource = await tx.query.resources.findFirst({
      where: and(eq(schema.resources.id, resourceId), eq(schema.resources.organizationId, organizationId)),
    });
    if (!resource) throw new NotFoundException("Resource not found");
    return resource;
  }

  // Resource management is org_admin-only ("manage all") — the
  // @CheckAbility("create"/"update"/"delete", "Resource") gate on the
  // controller is the complete check, same as ServingRolesService.
  async createResource(tx: Database, organizationId: string, input: CreateResourceInput) {
    const [resource] = await tx
      .insert(schema.resources)
      .values({ organizationId, ...input })
      .returning();
    if (!resource) throw new Error("Resource insert returned no row");
    return resource;
  }

  async updateResource(tx: Database, organizationId: string, resourceId: string, input: UpdateResourceInput) {
    const resource = await this.getResource(tx, organizationId, resourceId);
    const [updated] = await tx
      .update(schema.resources)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schema.resources.id, resource.id))
      .returning();
    return updated;
  }

  async deleteResource(tx: Database, organizationId: string, resourceId: string) {
    const resource = await this.getResource(tx, organizationId, resourceId);
    try {
      await tx.delete(schema.resources).where(eq(schema.resources.id, resource.id));
    } catch (err) {
      // 23503 = foreign_key_violation — booking_requests.resource_id has
      // no cascade delete, deliberately, so booking history isn't
      // silently lost when a resource is retired.
      if (pgErrorCode(err) === "23503") {
        throw new ConflictException("Cannot delete a resource with existing booking requests");
      }
      throw err;
    }
  }

  /**
   * Read-only overlap view for a resource: powers both the org_admin's
   * resource calendar and a submit-time "soft overlap warning" (shown,
   * never blocking — see docs/ARCHITECTURE.md). Includes pending AND
   * approved rows — a leader should see contention even before anything's
   * approved — via a plain range-overlap comparison, not the DB exclusion
   * constraint (that only ever compares against *approved* rows).
   */
  async getResourceCalendar(tx: Database, organizationId: string, resourceId: string, from: Date, to: Date) {
    await this.getResource(tx, organizationId, resourceId);
    return tx.query.bookingRequests.findMany({
      where: and(
        eq(schema.bookingRequests.organizationId, organizationId),
        eq(schema.bookingRequests.resourceId, resourceId),
        or(eq(schema.bookingRequests.status, "pending"), eq(schema.bookingRequests.status, "approved")),
        lt(schema.bookingRequests.startsAt, to),
        gt(schema.bookingRequests.endsAt, from),
      ),
      orderBy: (b, { asc }) => [asc(b.startsAt)],
    });
  }
}
