import Link from "next/link";
import { Button, FormField, PageHeader, Select, Table, Td, TextInput, Th } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import type { Resource, Service } from "@pylr/schemas";
import { createServiceAction } from "./actions";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ organizationId: string; teamId: string }>;
}) {
  const { organizationId, teamId } = await params;
  const [services, resources] = await Promise.all([
    apiFetch<Service[]>(`/organizations/${organizationId}/teams/${teamId}/services`),
    apiFetch<Resource[]>(`/organizations/${organizationId}/resources`),
  ]);
  const create = createServiceAction.bind(null, organizationId, teamId);

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}/teams`}>← Teams</Link>
      </p>
      <PageHeader eyebrow="Schedule" title="Services" />

      <Table>
        <thead>
          <tr>
            <Th>Service</Th>
            <Th>Recurrence</Th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <Td>
                <Link href={`/dashboard/${organizationId}/teams/${teamId}/services/${s.id}`} style={{ fontWeight: 700 }}>
                  {s.name}
                </Link>
              </Td>
              <Td>{s.recurrenceRule ? `${s.recurrenceRule}, ${s.defaultTime}` : "One-off"}</Td>
            </tr>
          ))}
          {services.length === 0 && (
            <tr>
              <Td colSpan={2}>No services yet — create one below.</Td>
            </tr>
          )}
        </tbody>
      </Table>

      <h2 style={{ fontSize: "1.1rem", margin: "var(--pylr-space-5) 0 var(--pylr-space-3)" }}>Create a service</h2>
      <form action={create} style={{ display: "grid", gap: "var(--pylr-space-3)", maxWidth: 420 }}>
        <FormField label="Name">
          <TextInput name="name" placeholder="Sunday Morning Service" required />
        </FormField>
        <FormField label="Recurrence rule (iCal RRULE, optional — leave blank for a one-off)">
          <TextInput name="recurrenceRule" placeholder="FREQ=WEEKLY;BYDAY=SU" />
        </FormField>
        <FormField label="Default time (required to generate occurrences)">
          <TextInput name="defaultTime" type="time" />
        </FormField>
        <FormField label="Default duration (minutes)">
          <TextInput name="defaultDurationMinutes" type="number" defaultValue={90} />
        </FormField>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--pylr-space-2)", fontSize: "0.85rem" }}>
          <input name="isPublic" type="checkbox" /> Eligible to promote publicly later (Phase 3)
        </label>
        <FormField label="Usual room/resource (optional — each generated occurrence reserves it through the normal booking queue)">
          <Select name="defaultResourceId" defaultValue="">
            <option value="">None</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div>
          <Button type="submit" variant="primary">
            Create service
          </Button>
        </div>
      </form>
    </div>
  );
}
