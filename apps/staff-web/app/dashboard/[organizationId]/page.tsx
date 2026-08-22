import { apiFetch } from "@/lib/api";
import type { Organization, OrganizationMember, User } from "@pylr/schemas";
import { inviteMemberAction } from "./actions";

type MemberWithUser = OrganizationMember & { user: User };

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [org, members] = await Promise.all([
    apiFetch<Organization>(`/organizations/${organizationId}`),
    apiFetch<MemberWithUser[]>(`/organizations/${organizationId}/members`),
  ]);

  const invite = inviteMemberAction.bind(null, organizationId);

  return (
    <div>
      <h1>{org.name}</h1>
      <p>
        <code>pylr.app/{org.slug}</code>
      </p>

      <h2>Team</h2>
      <ul>
        {members.map((m) => (
          <li key={m.id}>
            {m.user.email} — {m.role} ({m.status})
          </li>
        ))}
      </ul>

      <h2>Invite someone</h2>
      <form action={invite} style={{ display: "grid", gap: "0.5rem", maxWidth: 360 }}>
        <input name="email" type="email" placeholder="email@example.com" required />
        <select name="role" defaultValue="team_member">
          <option value="org_admin">Org admin</option>
          <option value="team_leader">Team leader</option>
          <option value="team_member">Team member</option>
        </select>
        <button type="submit">Send invite</button>
      </form>
    </div>
  );
}
