import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Team } from "@pylr/schemas";
import { createTeamAction } from "./actions";

export default async function TeamsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const teams = await apiFetch<Team[]>(`/organizations/${organizationId}/teams`);
  const create = createTeamAction.bind(null, organizationId);

  return (
    <div>
      <h1>Teams</h1>
      <ul>
        {teams.map((t) => (
          <li key={t.id}>
            <Link href={`/dashboard/${organizationId}/teams/${t.id}/services`}>{t.name}</Link> <small>({t.type})</small>{" "}
            — <Link href={`/dashboard/${organizationId}/teams/${t.id}/booking-requests`}>book a resource</Link>
          </li>
        ))}
        {teams.length === 0 && <li>No teams yet — create one below.</li>}
      </ul>

      <h2>Create a team</h2>
      <form action={create} style={{ display: "grid", gap: "0.5rem", maxWidth: 360 }}>
        <input name="name" placeholder="Worship Team" required />
        <select name="type" defaultValue="ministry">
          <option value="ministry">Ministry</option>
          <option value="small_group">Small group</option>
          <option value="staff_team">Staff team</option>
          <option value="informal">Informal</option>
        </select>
        <button type="submit">Create team</button>
      </form>
    </div>
  );
}
