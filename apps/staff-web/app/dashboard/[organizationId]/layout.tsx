import type { ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { Sidebar } from "@pylr/ui";
import type { NavGroupData } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import type { Organization, OrganizationMember } from "@pylr/schemas";

type MyMembership = OrganizationMember & { organization: Organization };

/**
 * The persistent left-nav shell every /dashboard/[organizationId]/**
 * page renders inside (mockups 1a–1j) — org identity + nav groups +
 * account footer live here once instead of every page hand-rolling a
 * back-link, which is what every Phase 1/2 page.tsx did before this.
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const [memberships, user] = await Promise.all([apiFetch<MyMembership[]>("/organizations/me"), currentUser()]);
  const membership = memberships.find((m) => m.organizationId === organizationId);
  const orgName = membership?.organization.name ?? "PYLR";
  const role = membership?.role ?? "team_member";
  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.emailAddresses[0]?.emailAddress || "You";

  const base = `/dashboard/${organizationId}`;
  const groups: NavGroupData[] = [
    {
      label: "Schedule",
      items: [
        { href: base, label: "Dashboard" },
        { href: `${base}/teams`, label: "Teams & Services" },
        { href: `${base}/people`, label: "People" },
        { href: `${base}/serving-roles`, label: "Serving Roles" },
        { href: `${base}/me/assignments`, label: "My Assignments" },
      ],
    },
    {
      label: "Spaces",
      items: [
        { href: `${base}/resources`, label: "Resources" },
        { href: `${base}/booking-requests`, label: "Booking Requests" },
        { href: `${base}/booking-requests/me`, label: "My Booking Requests" },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", alignItems: "stretch" }}>
      <Sidebar orgName={orgName} groups={groups} userName={userName} userRole={role} userMenu={<UserButton />} />
      <div style={{ flex: 1, minWidth: 0, padding: "var(--pylr-space-6)" }}>{children}</div>
    </div>
  );
}
