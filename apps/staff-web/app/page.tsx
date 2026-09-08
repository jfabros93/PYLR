import Link from "next/link";
import { LinkButton } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import type { Organization, OrganizationMember } from "@pylr/schemas";

type MyMembership = OrganizationMember & { organization: Organization };

export default async function HomePage() {
  const memberships = await apiFetch<MyMembership[]>("/organizations/me");

  if (memberships.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: "3rem auto", padding: "0 1.5rem" }}>
        <h1 style={{ fontFamily: "var(--pylr-font-display)", fontSize: "2rem", marginBottom: "var(--pylr-space-3)" }}>
          Welcome to PYLR
        </h1>
        <p style={{ color: "var(--pylr-ink-muted)", marginBottom: "var(--pylr-space-4)" }}>
          You don&apos;t belong to a church workspace yet.
        </p>
        <LinkButton href="/onboarding" variant="primary">
          Create your church&apos;s workspace →
        </LinkButton>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "3rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontFamily: "var(--pylr-font-display)", fontSize: "2rem", marginBottom: "var(--pylr-space-4)" }}>
        Your churches
      </h1>
      {memberships.map((m) => (
        <div
          key={m.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "var(--pylr-space-3) 0",
            borderBottom: "1px solid var(--pylr-rule-light)",
          }}
        >
          <div>
            <Link href={`/dashboard/${m.organizationId}`} style={{ fontWeight: 700, fontSize: "1.05rem" }}>
              {m.organization.name}
            </Link>
            <div style={{ fontSize: "0.8rem", color: "var(--pylr-ink-muted)" }}>{m.role}</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: "var(--pylr-space-4)" }}>
        <LinkButton href="/onboarding">+ Create another workspace</LinkButton>
      </div>
    </div>
  );
}
