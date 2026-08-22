import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { BookingRequest, Resource } from "@pylr/schemas";
import { resubmitBookingRequestAction, withdrawBookingRequestAction } from "./actions";

/** yyyy-MM-ddTHH:mm, the format <input type="datetime-local"> expects for a defaultValue. */
function toLocalInputValue(date: Date): string {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default async function MyBookingRequestsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const [mine, resources] = await Promise.all([
    apiFetch<BookingRequest[]>(`/organizations/${organizationId}/booking-requests/me`),
    apiFetch<Resource[]>(`/organizations/${organizationId}/resources`),
  ]);

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}`}>← Dashboard</Link>
      </p>
      <h1>My Booking Requests</h1>
      <ul style={{ display: "grid", gap: "1rem", padding: 0, listStyle: "none" }}>
        {mine.map((b) => {
          const withdraw = withdrawBookingRequestAction.bind(null, organizationId, b.id);
          const resubmit = resubmitBookingRequestAction.bind(null, organizationId, b.id);
          const canWithdraw = b.status === "pending" || b.status === "changes_requested";
          return (
            <li key={b.id} style={{ border: "1px solid #ccc", padding: "0.75rem", borderRadius: 4 }}>
              <strong>{resources.find((r) => r.id === b.resourceId)?.name ?? "Unknown resource"}</strong>{" "}
              <em>({b.status})</em>
              <br />
              {new Date(b.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} –{" "}
              {new Date(b.endsAt).toLocaleTimeString(undefined, { timeStyle: "short" })}
              {b.reviewNote && (
                <>
                  <br />
                  <small>Admin note: {b.reviewNote}</small>
                </>
              )}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                {b.status === "changes_requested" && (
                  <form action={resubmit} style={{ display: "flex", gap: "0.25rem", alignItems: "flex-end" }}>
                    <label>
                      Starts
                      <input name="startsAt" type="datetime-local" defaultValue={toLocalInputValue(b.startsAt)} />
                    </label>
                    <label>
                      Ends
                      <input name="endsAt" type="datetime-local" defaultValue={toLocalInputValue(b.endsAt)} />
                    </label>
                    <button type="submit">Resubmit</button>
                  </form>
                )}
                {canWithdraw && (
                  <form action={withdraw}>
                    <button type="submit">Withdraw</button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
        {mine.length === 0 && <li>You haven&apos;t submitted any booking requests yet.</li>}
      </ul>
    </div>
  );
}
