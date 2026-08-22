import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Service, ServiceOccurrence } from "@pylr/schemas";
import { generateOccurrencesAction } from "./actions";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; teamId: string; serviceId: string }>;
}) {
  const { organizationId, teamId, serviceId } = await params;
  const [service, occurrences] = await Promise.all([
    apiFetch<Service>(`/organizations/${organizationId}/teams/${teamId}/services/${serviceId}`),
    apiFetch<ServiceOccurrence[]>(`/organizations/${organizationId}/teams/${teamId}/services/${serviceId}/occurrences`),
  ]);
  const generate = generateOccurrencesAction.bind(null, organizationId, teamId, serviceId);

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}/teams/${teamId}/services`}>← Services</Link>
      </p>
      <h1>{service.name}</h1>
      {service.recurrenceRule ? (
        <p>
          <code>{service.recurrenceRule}</code> at {service.defaultTime}, {service.defaultDurationMinutes} min
        </p>
      ) : (
        <p>No recurrence rule set — this is a one-off service.</p>
      )}

      <h2>Occurrences</h2>
      <ul>
        {occurrences.map((o) => (
          <li key={o.id}>
            <Link href={`/dashboard/${organizationId}/occurrences/${o.id}/plan`}>
              {new Date(o.occursAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </Link>{" "}
            <small>({o.status})</small>
          </li>
        ))}
        {occurrences.length === 0 && <li>No occurrences generated yet.</li>}
      </ul>

      {service.recurrenceRule && service.defaultTime ? (
        <form action={generate}>
          <button type="submit">Generate next 8 occurrences</button>
        </form>
      ) : (
        <p>
          <small>Set a recurrence rule and default time on the service to generate occurrences.</small>
        </p>
      )}
    </div>
  );
}
