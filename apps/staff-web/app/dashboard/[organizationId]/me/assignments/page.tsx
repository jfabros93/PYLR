import Link from "next/link";
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
      <p>
        <Link href={`/dashboard/${organizationId}`}>← Dashboard</Link>
      </p>
      <h1>My Assignments</h1>
      <ul>
        {assignments.map((a) => (
          <li key={a.id} style={{ marginBottom: "0.75rem" }}>
            <strong>{a.servingRole.name}</strong> — {a.plan.serviceOccurrence.service.name} on{" "}
            {new Date(a.plan.serviceOccurrence.occursAt).toLocaleDateString(undefined, { dateStyle: "medium" })}{" "}
            (<em>{a.status}</em>){" "}
            {a.status !== "confirmed" && (
              <form
                action={respondToAssignmentAction.bind(null, organizationId, a.plan.id, a.id, "confirmed")}
                style={{ display: "inline" }}
              >
                <button type="submit">Confirm</button>
              </form>
            )}{" "}
            {a.status !== "declined" && (
              <form
                action={respondToAssignmentAction.bind(null, organizationId, a.plan.id, a.id, "declined")}
                style={{ display: "inline" }}
              >
                <button type="submit">Decline</button>
              </form>
            )}
          </li>
        ))}
        {assignments.length === 0 && <li>No assignments yet.</li>}
      </ul>
    </div>
  );
}
