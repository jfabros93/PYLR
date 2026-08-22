import { schema } from "@pylr/db";
import type { Database } from "@pylr/db";

/**
 * drizzle-orm's postgres-js driver wraps every query failure in its own
 * `DrizzleQueryError`, whose `.message` is a generic "Failed query: ..."
 * string — the underlying `postgres` driver's `PostgresError` (which
 * carries the real SQLSTATE on `.code`) is its `.cause`, not itself. Both
 * are checked here so this keeps working if that wrapping ever changes.
 */
export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}

/**
 * Inserts a `pending` booking_requests row. Shared by
 * BookingRequestsService.createBookingRequest (ad-hoc submissions) and
 * ServicesService.generateOccurrences (a recurring service's room
 * reservation) so both go through the exact same approval queue — no
 * bypass for either path. Kept as a standalone function rather than
 * injecting BookingRequestsService into SchedulingModule (or vice versa)
 * to avoid a module-level dependency cycle on top of the schema-level one
 * booking.ts already has on scheduling.ts.
 */
export async function insertPendingBookingRequest(
  tx: Database,
  params: {
    organizationId: string;
    requestingTeamId: string;
    resourceId: string;
    startsAt: Date;
    endsAt: Date;
    purpose?: string;
    relatedServiceOccurrenceId?: string;
    requestedByUserId: string;
  },
) {
  const [created] = await tx
    .insert(schema.bookingRequests)
    .values({ ...params, status: "pending" })
    .returning();
  if (!created) throw new Error("Booking request insert returned no row");
  return created;
}
