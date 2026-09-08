import { PageHeader, Panel, Button, TextInput } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import { findConflicts } from "@/lib/overlaps";
import type { BookingRequest, Resource, Team } from "@pylr/schemas";
import { approveBookingRequestAction, denyBookingRequestAction, requestChangesBookingRequestAction } from "./actions";

export default async function BookingRequestsQueuePage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const [pending, approved, resources, teams] = await Promise.all([
    apiFetch<BookingRequest[]>(`/organizations/${organizationId}/booking-requests?status=pending`),
    apiFetch<BookingRequest[]>(`/organizations/${organizationId}/booking-requests?status=approved`),
    apiFetch<Resource[]>(`/organizations/${organizationId}/resources`),
    apiFetch<Team[]>(`/organizations/${organizationId}/teams`),
  ]);
  const conflicts = findConflicts(pending, approved);
  const resourceName = (id: string) => resources.find((r) => r.id === id)?.name ?? "Unknown resource";
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "Unknown team";
  const range = (b: BookingRequest) =>
    `${new Date(b.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} – ${new Date(
      b.endsAt,
    ).toLocaleTimeString(undefined, { timeStyle: "short" })}`;

  const actionsFor = (b: BookingRequest) => {
    const approve = approveBookingRequestAction.bind(null, organizationId, b.id);
    const deny = denyBookingRequestAction.bind(null, organizationId, b.id);
    const requestChanges = requestChangesBookingRequestAction.bind(null, organizationId, b.id);
    return (
      <div style={{ display: "flex", gap: "var(--pylr-space-2)", marginTop: "var(--pylr-space-2)", flexWrap: "wrap", alignItems: "center" }}>
        <form action={approve}>
          <Button type="submit" variant="primary">
            Approve
          </Button>
        </form>
        <form action={deny} style={{ display: "flex", gap: "var(--pylr-space-1)" }}>
          <TextInput name="reviewNote" placeholder="Reason (optional)" style={{ width: 180 }} />
          <Button type="submit">Deny</Button>
        </form>
        <form action={requestChanges} style={{ display: "flex", gap: "var(--pylr-space-1)" }}>
          <TextInput name="reviewNote" placeholder="What needs to change?" style={{ width: 200 }} />
          <Button type="submit">Request changes</Button>
        </form>
      </div>
    );
  };

  const contended = pending.filter((b) => conflicts.has(b.id));
  const clear = pending.filter((b) => !conflicts.has(b.id));

  return (
    <div>
      <PageHeader eyebrow={`${pending.length} pending`} title="Booking Requests" />

      {contended.length > 0 && (
        <Panel variant="attention" title={`Contention — ${contended.length} request${contended.length > 1 ? "s" : ""} overlap another`}>
          <p style={{ fontSize: "0.85rem", marginBottom: "var(--pylr-space-3)" }}>
            Approving one of a conflicting pair makes the database reject the other — resolve which one wins here.
          </p>
          {contended.map((b) => (
            <div key={b.id} style={{ marginBottom: "var(--pylr-space-4)", paddingBottom: "var(--pylr-space-3)", borderBottom: "1px solid var(--pylr-rule-light)" }}>
              <strong>{resourceName(b.resourceId)}</strong> for {teamName(b.requestingTeamId)}
              <br />
              {range(b)}
              {b.purpose && (
                <>
                  <br />
                  <small style={{ color: "var(--pylr-ink-muted)" }}>{b.purpose}</small>
                </>
              )}
              <div style={{ fontSize: "0.8rem", color: "var(--pylr-red)", marginTop: "var(--pylr-space-1)" }}>
                Overlaps {conflicts.get(b.id)!.length} other request{conflicts.get(b.id)!.length > 1 ? "s" : ""}:{" "}
                {conflicts.get(b.id)!.map((o) => range(o)).join("; ")}
              </div>
              {actionsFor(b)}
            </div>
          ))}
        </Panel>
      )}

      <h2 style={{ fontSize: "1rem", margin: "var(--pylr-space-5) 0 var(--pylr-space-3)" }}>No conflicts</h2>
      {clear.map((b) => (
        <div key={b.id} style={{ padding: "var(--pylr-space-3) 0", borderBottom: "1px solid var(--pylr-rule-light)" }}>
          <strong>{resourceName(b.resourceId)}</strong> for {teamName(b.requestingTeamId)}
          <br />
          {range(b)}
          {b.purpose && (
            <>
              <br />
              <small style={{ color: "var(--pylr-ink-muted)" }}>{b.purpose}</small>
            </>
          )}
          {actionsFor(b)}
        </div>
      ))}
      {pending.length === 0 && <p style={{ color: "var(--pylr-ink-muted)" }}>Nothing pending.</p>}
    </div>
  );
}
