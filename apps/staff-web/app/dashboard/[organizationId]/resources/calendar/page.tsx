import { Fragment } from "react";
import Link from "next/link";
import { CalendarBlock, PageHeader } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import { bucketByDay, startOfWeek, weekDays } from "@/lib/week-grid";
import type { BookingRequest, Resource } from "@pylr/schemas";

/**
 * The full multi-resource week grid (mockup 1e) — every resource as a
 * row, days as columns. Built with zero new backend endpoints: fetch the
 * resource list, then fan out Promise.all over the existing
 * per-resource /calendar endpoint and lay the results out as a grid.
 */
export default async function ResourcesCalendarPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const days = weekDays(weekStart);

  const resources = await apiFetch<Resource[]>(`/organizations/${organizationId}/resources`);
  const calendars = await Promise.all(
    resources.map((r) =>
      apiFetch<BookingRequest[]>(
        `/organizations/${organizationId}/resources/${r.id}/calendar?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`,
      ),
    ),
  );

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}/resources`}>← Resources</Link>
      </p>
      <PageHeader
        eyebrow={`${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${new Date(weekEnd.getTime() - 1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
        title="Resource calendar"
      />

      <div style={{ display: "grid", gridTemplateColumns: "160px repeat(7, 1fr)", border: "var(--pylr-rule-width) solid var(--pylr-rule)" }}>
        <div style={{ borderBottom: "var(--pylr-rule-width) solid var(--pylr-rule)", borderRight: "var(--pylr-rule-width) solid var(--pylr-rule)" }} />
        {days.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              padding: "var(--pylr-space-2)",
              borderBottom: "var(--pylr-rule-width) solid var(--pylr-rule)",
              borderLeft: i > 0 ? "1px solid var(--pylr-rule-light)" : undefined,
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--pylr-ink-muted)",
            }}
          >
            {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
          </div>
        ))}

        {resources.map((resource, rowIndex) => {
          const byDay = bucketByDay(calendars[rowIndex]!, weekStart);
          return (
            <Fragment key={resource.id}>
              <div
                style={{
                  padding: "var(--pylr-space-2)",
                  borderRight: "var(--pylr-rule-width) solid var(--pylr-rule)",
                  borderTop: "1px solid var(--pylr-rule-light)",
                }}
              >
                <Link href={`/dashboard/${organizationId}/resources/${resource.id}`} style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                  {resource.name}
                </Link>
                {resource.capacity && (
                  <div style={{ fontSize: "0.75rem", color: "var(--pylr-ink-muted)" }}>Seats {resource.capacity}</div>
                )}
              </div>
              {days.map((_, dayIndex) => (
                <div
                  key={`${resource.id}-${dayIndex}`}
                  style={{
                    padding: "var(--pylr-space-1)",
                    borderTop: "1px solid var(--pylr-rule-light)",
                    borderLeft: dayIndex > 0 ? "1px solid var(--pylr-rule-light)" : undefined,
                    minHeight: 60,
                  }}
                >
                  {byDay[dayIndex]!.map((b) => (
                    <CalendarBlock
                      key={b.id}
                      status={b.status === "approved" ? "approved" : "pending"}
                      timeLabel={new Date(b.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      title={b.purpose ?? "Booking"}
                    />
                  ))}
                </div>
              ))}
            </Fragment>
          );
        })}
      </div>
      {resources.length === 0 && (
        <p style={{ color: "var(--pylr-ink-muted)", marginTop: "var(--pylr-space-3)" }}>No resources yet.</p>
      )}
      <p style={{ fontSize: "0.8rem", color: "var(--pylr-ink-muted)", marginTop: "var(--pylr-space-2)" }}>
        Solid = approved. Hatched = pending — overlapping approvals are rejected by the database, not the UI.
      </p>
    </div>
  );
}
