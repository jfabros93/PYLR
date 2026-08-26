import Link from "next/link";
import { Badge, Button, FormField, PageHeader, Select, TextInput } from "@pylr/ui";
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
      <PageHeader
        eyebrow="Submitting doesn't block on conflicts — an admin sees contention and decides"
        title="Booking Requests"
      />

      <h2 style={{ fontSize: "1rem", marginBottom: "var(--pylr-space-2)" }}>This team&apos;s requests</h2>
      {teamBookings.map((b) => (
        <div
          key={b.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "var(--pylr-space-2) 0",
            borderBottom: "1px solid var(--pylr-rule-light)",
          }}
        >
          <div>
            {resources.find((r) => r.id === b.resourceId)?.name ?? "Unknown resource"} —{" "}
            {new Date(b.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </div>
          <Badge>{b.status}</Badge>
        </div>
      ))}
      {teamBookings.length === 0 && <p style={{ color: "var(--pylr-ink-muted)" }}>No requests yet.</p>}

      <h2 style={{ fontSize: "1rem", margin: "var(--pylr-space-5) 0 var(--pylr-space-3)" }}>Submit a request</h2>
      {resources.length === 0 ? (
        <p style={{ color: "var(--pylr-ink-muted)" }}>No resources exist yet — an org admin needs to add one under Resources first.</p>
      ) : (
        <form action={create} style={{ display: "grid", gap: "var(--pylr-space-3)", maxWidth: 420 }}>
          <FormField label="Resource">
            <Select name="resourceId" required>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Starts">
            <TextInput name="startsAt" type="datetime-local" required />
          </FormField>
          <FormField label="Ends">
            <TextInput name="endsAt" type="datetime-local" required />
          </FormField>
          <FormField label="Purpose (optional)">
            <TextInput name="purpose" />
          </FormField>
          <div>
            <Button type="submit" variant="primary">
              Submit request
            </Button>
          </div>
        </form>
      )}
      <p style={{ fontSize: "0.8rem", color: "var(--pylr-ink-muted)", marginTop: "var(--pylr-space-3)" }}>
        Tip: check a <Link href={`/dashboard/${organizationId}/resources/calendar`}>resource&apos;s calendar</Link> before
        submitting — pending/approved requests never reject each other automatically, an admin resolves contention.
      </p>
    </div>
  );
}
