import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Organization, OrganizationMember } from "@pylr/schemas";

type MyMembership = OrganizationMember & { organization: Organization };

export default async function HomePage() {
  const memberships = await apiFetch<MyMembership[]>("/organizations/me");

  if (memberships.length === 0) {
    return (
      <div>
        <h1>Welcome to PYLR</h1>
        <p>You don&apos;t belong to a church workspace yet.</p>
        <Link href="/onboarding">Create your church&apos;s workspace →</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Your churches</h1>
      <ul>
        {memberships.map((m) => (
          <li key={m.id}>
            <Link href={`/dashboard/${m.organizationId}`}>{m.organization.name}</Link>{" "}
            <small>({m.role})</small>
          </li>
        ))}
      </ul>
      <Link href="/onboarding">+ Create another workspace</Link>
    </div>
  );
}
