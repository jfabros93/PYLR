import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { ServingRole } from "@pylr/schemas";
import { createServingRoleAction } from "./actions";

export default async function ServingRolesPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const roles = await apiFetch<ServingRole[]>(`/organizations/${organizationId}/serving-roles`);
  const create = createServingRoleAction.bind(null, organizationId);

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}`}>← Dashboard</Link>
      </p>
      <h1>Serving Roles</h1>
      <p>
        <small>
          The types of roles that can appear in a plan&apos;s serving grid (Sound Tech, Greeter, Worship Leader, …).
          Org-admin only — team leaders fill these in on individual plans.
        </small>
      </p>
      <ul>
        {roles.map((r) => (
          <li key={r.id}>{r.name}</li>
        ))}
        {roles.length === 0 && <li>No serving roles yet — create one below.</li>}
      </ul>

      <form action={create} style={{ display: "flex", gap: "0.5rem", maxWidth: 360 }}>
        <input name="name" placeholder="Sound Tech" required />
        <button type="submit">Add role</button>
      </form>
    </div>
  );
}
