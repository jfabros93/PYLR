import Link from "next/link";
import { LinkButton, Panel, StatRow, StatTile } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import { findConflicts } from "@/lib/overlaps";
import { startOfWeek } from "@/lib/week-grid";
import type { BookingRequest, Person, Plan, Service, ServiceOccurrence, ServingRole, Team } from "@pylr/schemas";

interface MyAssignment {
  id: string;
  status: "invited" | "confirmed" | "declined";
  servingRole: ServingRole;
  plan: Plan & { serviceOccurrence: ServiceOccurrence & { service: Service } };
}

export default async function DashboardPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [teams, pendingBookings, approvedBookings, myAssignments, people] = await Promise.all([
    apiFetch<Team[]>(`/organizations/${organizationId}/teams`),
    apiFetch<BookingRequest[]>(`/organizations/${organizationId}/booking-requests?status=pending`),
    apiFetch<BookingRequest[]>(`/organizations/${organizationId}/booking-requests?status=approved`),
    apiFetch<MyAssignment[]>(`/organizations/${organizationId}/plans/me/assignments`),
    apiFetch<Person[]>(`/organizations/${organizationId}/people`),
  ]);

  // "This week's occurrences" needs a team -> services -> occurrences
  // fan-out (there's no org-wide occurrence listing endpoint) — every
  // call here is a plain read with no side effects, unlike the
  // plan-detail endpoint (which auto-creates a draft plan on first
  // access), so that one is deliberately NOT called from this passive
  // dashboard view.
  const servicesPerTeam = await Promise.all(
    teams.map(async (team) => ({
      team,
      services: await apiFetch<Service[]>(`/organizations/${organizationId}/teams/${team.id}/services`),
    })),
  );
  const occurrenceLists = await Promise.all(
    servicesPerTeam.flatMap(({ team, services }) =>
      services.map(async (service) => {
        const occurrences = await apiFetch<ServiceOccurrence[]>(
          `/organizations/${organizationId}/teams/${team.id}/services/${service.id}/occurrences`,
        );
        return occurrences.map((o) => ({ occurrence: o, serviceName: service.name, teamName: team.name }));
      }),
    ),
  );
  const thisWeek = occurrenceLists
    .flat()
    .filter(({ occurrence }) => {
      const d = new Date(occurrence.occursAt);
      return d >= weekStart && d < weekEnd;
    })
    .sort((a, b) => new Date(a.occurrence.occursAt).getTime() - new Date(b.occurrence.occursAt).getTime());

  const conflicts = findConflicts(pendingBookings, approvedBookings);
  const needsConfirmation = myAssignments.filter((a) => a.status !== "confirmed");

  const byDay = new Map<string, typeof thisWeek>();
  for (const item of thisWeek) {
    const key = new Date(item.occurrence.occursAt).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  return (
    <div>
      <div style={{ textTransform: "uppercase", fontSize: "0.75rem", color: "var(--pylr-ink-muted)" }}>
        Week of {weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "var(--pylr-space-3)",
          marginBottom: "var(--pylr-space-5)",
        }}
      >
        <h1 style={{ fontFamily: "var(--pylr-font-display)", fontSize: "2.25rem" }}>This week</h1>
        <div style={{ display: "flex", gap: "var(--pylr-space-2)" }}>
          <LinkButton href={`/dashboard/${organizationId}/teams`}>Teams &amp; Services</LinkButton>
        </div>
      </div>

      <StatRow>
        <StatTile label="Occurrences" value={thisWeek.length} sub="this week" />
        <StatTile
          label="Booking requests"
          value={pendingBookings.length}
          sub={conflicts.size > 0 ? `${conflicts.size} with a conflict` : "pending"}
          tone={conflicts.size > 0 ? "accent" : "default"}
        />
        <StatTile
          label="My assignments"
          value={needsConfirmation.length}
          sub={needsConfirmation.length > 0 ? "need your response" : "all confirmed"}
          tone={needsConfirmation.length > 0 ? "accent" : "default"}
        />
        <StatTile label="People" value={people.length} sub={`${teams.length} teams`} />
      </StatRow>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--pylr-space-5)", marginTop: "var(--pylr-space-5)", alignItems: "start" }}>
        <div>
          {[...byDay.entries()].map(([day, items]) => (
            <div key={day} style={{ marginBottom: "var(--pylr-space-4)" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--pylr-space-2)" }}>
                {new Date(day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </h2>
              {items.map(({ occurrence, serviceName, teamName }) => (
                <Link
                  key={occurrence.id}
                  href={`/dashboard/${organizationId}/occurrences/${occurrence.id}/plan`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "var(--pylr-space-2) 0",
                    borderBottom: "1px solid var(--pylr-rule-light)",
                    textDecoration: "none",
                  }}
                >
                  <span>
                    <strong>{new Date(occurrence.occursAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</strong>{" "}
                    {serviceName}
                  </span>
                  <span style={{ color: "var(--pylr-ink-muted)", fontSize: "0.85rem" }}>{teamName}</span>
                </Link>
              ))}
            </div>
          ))}
          {thisWeek.length === 0 && <p style={{ color: "var(--pylr-ink-muted)" }}>Nothing scheduled this week yet.</p>}
        </div>

        <Panel title="Needs you" variant={conflicts.size > 0 || needsConfirmation.length > 0 ? "attention" : "default"}>
          {conflicts.size === 0 && needsConfirmation.length === 0 && (
            <p style={{ fontSize: "0.85rem", color: "var(--pylr-ink-muted)" }}>Nothing needs your attention.</p>
          )}
          {conflicts.size > 0 && (
            <div style={{ marginBottom: "var(--pylr-space-3)" }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "var(--pylr-space-1)" }}>
                {conflicts.size} booking request{conflicts.size > 1 ? "s" : ""} overlap another
              </div>
              <Link href={`/dashboard/${organizationId}/booking-requests`} style={{ fontSize: "0.85rem" }}>
                Review the queue →
              </Link>
            </div>
          )}
          {needsConfirmation.map((a) => (
            <div key={a.id} style={{ fontSize: "0.85rem", padding: "var(--pylr-space-1) 0" }}>
              {a.servingRole.name} · {a.plan.serviceOccurrence.service.name}{" "}
              <Link href={`/dashboard/${organizationId}/me/assignments`}>Confirm →</Link>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
