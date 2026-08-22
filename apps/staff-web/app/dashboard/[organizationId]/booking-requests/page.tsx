import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { BookingRequest, Resource, Team } from "@pylr/schemas";
import { approveBookingRequestAction, denyBookingRequestAction, requestChangesBookingRequestAction } from "./actions";

export default async function BookingRequestsQueuePage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const [pending, resources, teams] = await Promise.all([
    apiFetch<BookingRequest[]>(`/organizations/${organizationId}/booking-requests?status=pending`),
    apiFetch<Resource[]>(`/organizations/${organizationId}/resources`),
    apiFetch<Team[]>(`/organizations/${organizationId}/teams`),
  ]);

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}`}>← Dashboard</Link>
      </p>
      <h1>Booking Requests</h1>
      <p>
        <small>Pending requests across every team and resource. Only approved requests can conflict with each other.</small>
      </p>

      <ul style={{ display: "grid", gap: "1rem", padding: 0, listStyle: "none" }}>
        {pending.map((b) => {
          const approve = approveBookingRequestAction.bind(null, organizationId, b.id);
          const deny = denyBookingRequestAction.bind(null, organizationId, b.id);
          const requestChanges = requestChangesBookingRequestAction.bind(null, organizationId, b.id);
          return (
            <li key={b.id} style={{ border: "1px solid #ccc", padding: "0.75rem", borderRadius: 4 }}>
              <strong>{resources.find((r) => r.id === b.resourceId)?.name ?? "Unknown resource"}</strong> for{" "}
              {teams.find((t) => t.id === b.requestingTeamId)?.name ?? "Unknown team"}
              <br />
              {new Date(b.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} –{" "}
              {new Date(b.endsAt).toLocaleTimeString(undefined, { timeStyle: "short" })}
              {b.purpose && (
                <>
                  <br />
                  <small>{b.purpose}</small>
                </>
              )}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center" }}>
                <form action={approve}>
                  <button type="submit">Approve</button>
                </form>
                <form action={deny} style={{ display: "flex", gap: "0.25rem" }}>
                  <input name="reviewNote" placeholder="Reason (optional)" />
                  <button type="submit">Deny</button>
                </form>
                <form action={requestChanges} style={{ display: "flex", gap: "0.25rem" }}>
                  <input name="reviewNote" placeholder="What needs to change?" />
                  <button type="submit">Request changes</button>
                </form>
              </div>
            </li>
          );
        })}
        {pending.length === 0 && <li>Nothing pending.</li>}
      </ul>
    </div>
  );
}
