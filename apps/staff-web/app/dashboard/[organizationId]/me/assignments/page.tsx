import { Badge, Button, PageHeader } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import type { Plan, Service, ServiceOccurrence, ServingRole } from "@pylr/schemas";
import { respondToAssignmentAction } from "./actions";

interface MyAssignment {
  id: string;
  status: "invited" | "confirmed" | "declined";
  servingRole: ServingRole;
  plan: Plan & { serviceOccurrence: ServiceOccurrence & { service: Service } };
}

export default async function MyAssignmentsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const assignments = await apiFetch<MyAssignment[]>(`/organizations/${organizationId}/plans/me/assignments`);

  return (
    <div>
      <PageHeader eyebrow="Schedule" title="My Assignments" />
      {assignments.map((a) => (
        <div
          key={a.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "var(--pylr-space-3) 0",
            borderBottom: "1px solid var(--pylr-rule-light)",
            gap: "var(--pylr-space-3)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong>{a.servingRole.name}</strong> — {a.plan.serviceOccurrence.service.name} on{" "}
            {new Date(a.plan.serviceOccurrence.occursAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </div>
          <div style={{ display: "flex", gap: "var(--pylr-space-2)", alignItems: "center" }}>
            <Badge>{a.status}</Badge>
            {a.status !== "confirmed" && (
              <form action={respondToAssignmentAction.bind(null, organizationId, a.plan.id, a.id, "confirmed")}>
                <Button type="submit" variant="primary">
                  Confirm
                </Button>
              </form>
            )}
            {a.status !== "declined" && (
              <form action={respondToAssignmentAction.bind(null, organizationId, a.plan.id, a.id, "declined")}>
                <Button type="submit">Decline</Button>
              </form>
            )}
          </div>
        </div>
      ))}
      {assignments.length === 0 && <p style={{ color: "var(--pylr-ink-muted)" }}>No assignments yet.</p>}
    </div>
  );
}
