import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Service } from "@pylr/schemas";
import { createServiceAction } from "./actions";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ organizationId: string; teamId: string }>;
}) {
  const { organizationId, teamId } = await params;
  const services = await apiFetch<Service[]>(`/organizations/${organizationId}/teams/${teamId}/services`);
  const create = createServiceAction.bind(null, organizationId, teamId);

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}/teams`}>← Teams</Link>
      </p>
      <h1>Services</h1>
      <ul>
        {services.map((s) => (
          <li key={s.id}>
            <Link href={`/dashboard/${organizationId}/teams/${teamId}/services/${s.id}`}>{s.name}</Link>{" "}
            {s.recurrenceRule && <small>({s.recurrenceRule}, {s.defaultTime})</small>}
          </li>
        ))}
        {services.length === 0 && <li>No services yet — create one below.</li>}
      </ul>

      <h2>Create a service</h2>
      <form action={create} style={{ display: "grid", gap: "0.5rem", maxWidth: 420 }}>
        <label>
          Name
          <input name="name" placeholder="Sunday Morning Service" required style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          Recurrence rule (iCal RRULE, optional — leave blank for a one-off)
          <input
            name="recurrenceRule"
            placeholder="FREQ=WEEKLY;BYDAY=SU"
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Default time (required to generate occurrences)
          <input name="defaultTime" type="time" style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          Default duration (minutes)
          <input name="defaultDurationMinutes" type="number" defaultValue={90} style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          <input name="isPublic" type="checkbox" /> Eligible to promote publicly later (Phase 3)
        </label>
        <button type="submit">Create service</button>
      </form>
    </div>
  );
}
