import Link from "next/link";
import { Badge, Button, PageHeader } from "@pylr/ui";
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
      <PageHeader
        eyebrow={service.recurrenceRule ? `${service.recurrenceRule} at ${service.defaultTime}, ${service.defaultDurationMinutes} min` : "One-off service"}
        title={service.name}
        actions={
          service.recurrenceRule && service.defaultTime ? (
            <form action={generate}>
              <Button type="submit" variant="primary">
                Generate next 8 occurrences
              </Button>
            </form>
          ) : undefined
        }
      />

      {!service.recurrenceRule && (
        <p style={{ color: "var(--pylr-ink-muted)", marginBottom: "var(--pylr-space-4)" }}>
          Set a recurrence rule and default time on the service to generate occurrences.
        </p>
      )}

      <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--pylr-space-3)" }}>Occurrences</h2>
      {occurrences.map((o) => (
        <div
          key={o.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "var(--pylr-space-2) 0",
            borderBottom: "1px solid var(--pylr-rule-light)",
          }}
        >
          <Link href={`/dashboard/${organizationId}/occurrences/${o.id}/plan`}>
            {new Date(o.occursAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </Link>
          <Badge>{o.status}</Badge>
        </div>
      ))}
      {occurrences.length === 0 && <p style={{ color: "var(--pylr-ink-muted)" }}>No occurrences generated yet.</p>}
    </div>
  );
}
