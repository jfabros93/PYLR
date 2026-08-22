import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { BookingRequest, Resource } from "@pylr/schemas";

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; resourceId: string }>;
}) {
  const { organizationId, resourceId } = await params;
  const from = new Date();
  const to = new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [resource, calendar] = await Promise.all([
    apiFetch<Resource>(`/organizations/${organizationId}/resources/${resourceId}`),
    apiFetch<BookingRequest[]>(
      `/organizations/${organizationId}/resources/${resourceId}/calendar?from=${from.toISOString()}&to=${to.toISOString()}`,
    ),
  ]);

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}/resources`}>← Resources</Link>
      </p>
      <h1>{resource.name}</h1>
      <p>
        <small>
          {resource.type}
          {resource.capacity ? `, capacity ${resource.capacity}` : ""}
          {resource.requiresApproval ? ", requires approval" : ", no approval required"}
        </small>
      </p>

      <h2>Next 30 days</h2>
      <p>
        <small>Pending and approved requests for this resource — the same overlap view shown when submitting a booking.</small>
      </p>
      <ul>
        {calendar.map((b) => (
          <li key={b.id}>
            {new Date(b.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} –{" "}
            {new Date(b.endsAt).toLocaleTimeString(undefined, { timeStyle: "short" })} <em>({b.status})</em>
            {b.purpose ? ` — ${b.purpose}` : ""}
          </li>
        ))}
        {calendar.length === 0 && <li>Nothing booked in the next 30 days.</li>}
      </ul>
    </div>
  );
}
