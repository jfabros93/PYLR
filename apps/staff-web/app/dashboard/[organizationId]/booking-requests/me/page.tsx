import { Badge, Button, PageHeader, TextInput } from "@pylr/ui";
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
      <PageHeader eyebrow="Spaces" title="My Booking Requests" />
      {mine.map((b) => {
        const withdraw = withdrawBookingRequestAction.bind(null, organizationId, b.id);
        const resubmit = resubmitBookingRequestAction.bind(null, organizationId, b.id);
        const canWithdraw = b.status === "pending" || b.status === "changes_requested";
        return (
          <div key={b.id} style={{ padding: "var(--pylr-space-3) 0", borderBottom: "1px solid var(--pylr-rule-light)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--pylr-space-2)" }}>
              <div>
                <strong>{resources.find((r) => r.id === b.resourceId)?.name ?? "Unknown resource"}</strong>
                <br />
                {new Date(b.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} –{" "}
                {new Date(b.endsAt).toLocaleTimeString(undefined, { timeStyle: "short" })}
                {b.reviewNote && (
                  <>
                    <br />
                    <small style={{ color: "var(--pylr-ink-muted)" }}>Admin note: {b.reviewNote}</small>
                  </>
                )}
              </div>
              <Badge>{b.status}</Badge>
            </div>
            <div style={{ display: "flex", gap: "var(--pylr-space-2)", marginTop: "var(--pylr-space-2)", alignItems: "flex-end", flexWrap: "wrap" }}>
              {b.status === "changes_requested" && (
                <form action={resubmit} style={{ display: "flex", gap: "var(--pylr-space-2)", alignItems: "flex-end" }}>
                  <label style={{ fontSize: "0.8rem" }}>
                    Starts
                    <TextInput name="startsAt" type="datetime-local" defaultValue={toLocalInputValue(b.startsAt)} />
                  </label>
                  <label style={{ fontSize: "0.8rem" }}>
                    Ends
                    <TextInput name="endsAt" type="datetime-local" defaultValue={toLocalInputValue(b.endsAt)} />
                  </label>
                  <Button type="submit" variant="primary">
                    Resubmit
                  </Button>
                </form>
              )}
              {canWithdraw && (
                <form action={withdraw}>
                  <Button type="submit">Withdraw</Button>
                </form>
              )}
            </div>
          </div>
        );
      })}
      {mine.length === 0 && <p style={{ color: "var(--pylr-ink-muted)" }}>You haven&apos;t submitted any booking requests yet.</p>}
    </div>
  );
}
