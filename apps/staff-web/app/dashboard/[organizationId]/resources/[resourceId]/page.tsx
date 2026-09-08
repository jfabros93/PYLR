import Link from "next/link";
import { CalendarBlock, PageHeader } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import { bucketByDay, startOfWeek, weekDays } from "@/lib/week-grid";
import type { BookingRequest, Resource } from "@pylr/schemas";

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; resourceId: string }>;
}) {
  const { organizationId, resourceId } = await params;
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const days = weekDays(weekStart);

  const [resource, calendar] = await Promise.all([
    apiFetch<Resource>(`/organizations/${organizationId}/resources/${resourceId}`),
    apiFetch<BookingRequest[]>(
      `/organizations/${organizationId}/resources/${resourceId}/calendar?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`,
    ),
  ]);
  const byDay = bucketByDay(calendar, weekStart);

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}/resources`}>← Resources</Link>
      </p>
      <PageHeader
        eyebrow={`${resource.type}${resource.capacity ? `, capacity ${resource.capacity}` : ""}${resource.requiresApproval ? "" : ", no approval required"}`}
        title={resource.name}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", border: "var(--pylr-rule-width) solid var(--pylr-rule)", borderLeft: "none" }}>
        {days.map((d, i) => (
          <div key={i} style={{ borderLeft: "var(--pylr-rule-width) solid var(--pylr-rule)" }}>
            <div
              style={{
                textAlign: "center",
                padding: "var(--pylr-space-2)",
                borderBottom: "var(--pylr-rule-width) solid var(--pylr-rule)",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--pylr-ink-muted)",
              }}
            >
              {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
            </div>
            <div style={{ padding: "var(--pylr-space-2)", minHeight: 160 }}>
              {byDay[i]!.map((b) => (
                <CalendarBlock
                  key={b.id}
                  status={b.status === "approved" ? "approved" : "pending"}
                  timeLabel={new Date(b.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  title={b.purpose ?? "Booking"}
                  subtitle={b.status !== "approved" ? b.status : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: "0.8rem", color: "var(--pylr-ink-muted)", marginTop: "var(--pylr-space-2)" }}>
        Solid = approved. Hatched = pending — only approved bookings block each other.
      </p>
    </div>
  );
}
