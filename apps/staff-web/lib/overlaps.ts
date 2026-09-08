import type { BookingRequest } from "@pylr/schemas";

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * For each pending booking, finds the other bookings (pending or already
 * approved) for the same resource whose time range overlaps it — pure
 * client-side computation over data GET /booking-requests already
 * returns, no new endpoint. Powers the "Needs you"/contention panels on
 * the dashboard and approvals queue (mockups 1a/1g): only approved rows
 * are ever structurally blocked from overlapping (the DB exclusion
 * constraint), but pending requests can still overlap each other or an
 * already-approved booking, and staff should see that before approving.
 */
export function findConflicts(pending: BookingRequest[], approved: BookingRequest[]): Map<string, BookingRequest[]> {
  const conflicts = new Map<string, BookingRequest[]>();
  const all = [...pending, ...approved];
  for (const p of pending) {
    const others = all.filter(
      (o) =>
        o.id !== p.id &&
        o.resourceId === p.resourceId &&
        rangesOverlap(new Date(p.startsAt), new Date(p.endsAt), new Date(o.startsAt), new Date(o.endsAt)),
    );
    if (others.length > 0) conflicts.set(p.id, others);
  }
  return conflicts;
}
