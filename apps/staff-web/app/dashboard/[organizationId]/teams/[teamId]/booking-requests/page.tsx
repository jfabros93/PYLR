import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { BookingRequest, Resource } from "@pylr/schemas";
import { createBookingRequestAction } from "./actions";

export default async function TeamBookingRequestsPage({
  params,
}: {
  params: Promise<{ organizationId: string; teamId: string }>;
}) {
  const { organizationId, teamId } = await params;
  const [resources, teamBookings] = await Promise.all([
    apiFetch<Resource[]>(`/organizations/${organizationId}/resources`),
    apiFetch<BookingRequest[]>(`/organizations/${organizationId}/booking-requests?teamId=${teamId}`),
  ]);
  const create = createBookingRequestAction.bind(null, organizationId, teamId);

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}/teams`}>← Teams</Link>
      </p>
      <h1>Booking Requests</h1>
      <p>
        <small>
          Request a room or piece of equipment for this team. Submitting doesn&apos;t block on conflicts — an admin
          sees any contention and decides; check a resource&apos;s calendar first if you want to avoid one.
        </small>
      </p>

      <h2>This team&apos;s requests</h2>
      <ul>
        {teamBookings.map((b) => (
          <li key={b.id}>
            {resources.find((r) => r.id === b.resourceId)?.name ?? "Unknown resource"} —{" "}
            {new Date(b.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{" "}
            <em>({b.status})</em>
          </li>
        ))}
        {teamBookings.length === 0 && <li>No requests yet.</li>}
      </ul>

      <h2>Submit a request</h2>
      {resources.length === 0 ? (
        <p>
          <small>No resources exist yet — an org admin needs to add one under Resources first.</small>
        </p>
      ) : (
        <form action={create} style={{ display: "grid", gap: "0.5rem", maxWidth: 420 }}>
          <label>
            Resource
            <select name="resourceId" required style={{ display: "block", width: "100%" }}>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Starts
            <input name="startsAt" type="datetime-local" required style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Ends
            <input name="endsAt" type="datetime-local" required style={{ display: "block", width: "100%" }} />
          </label>
          <label>
            Purpose (optional)
            <input name="purpose" style={{ display: "block", width: "100%" }} />
          </label>
          <button type="submit">Submit request</button>
        </form>
      )}
      <p>
        <small>
          Tip: check a <Link href={`/dashboard/${organizationId}/resources`}>resource&apos;s calendar</Link> before
          submitting — pending/approved requests never reject each other automatically, an admin resolves contention.
        </small>
      </p>
    </div>
  );
}
