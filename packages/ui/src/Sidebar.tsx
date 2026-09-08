"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroupData {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  orgName: string;
  groups: NavGroupData[];
  userName: string;
  userRole: string;
  userMenu?: ReactNode;
}

/**
 * The persistent left nav shell every dashboard page renders inside —
 * see apps/staff-web/app/dashboard/[organizationId]/layout.tsx. A client
 * component because highlighting the active route needs usePathname();
 * everything it renders is still just navigation, no data-fetching.
 */
export function Sidebar({ orgName, groups, userName, userRole, userMenu }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: "var(--pylr-rule-width) solid var(--pylr-rule)",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <div style={{ padding: "var(--pylr-space-4)" }}>
        <div
          style={{
            fontFamily: "var(--pylr-font-display, inherit)",
            fontWeight: 800,
            fontSize: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "var(--pylr-space-2)",
          }}
        >
          <span style={{ width: 14, height: 14, background: "var(--pylr-red)", display: "inline-block" }} />
          PYLR
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--pylr-ink-muted)", marginTop: "0.2rem" }}>{orgName}</div>
      </div>

      <nav style={{ flex: 1, padding: "0 var(--pylr-space-2)" }}>
        {groups.map((group) => (
          <div key={group.label} style={{ marginBottom: "var(--pylr-space-4)" }}>
            <div
              style={{
                textTransform: "uppercase",
                fontSize: "0.7rem",
                letterSpacing: "0.04em",
                color: "var(--pylr-ink-faint)",
                padding: "0 var(--pylr-space-2)",
                marginBottom: "var(--pylr-space-1)",
              }}
            >
              {group.label}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "block",
                    padding: "0.4rem var(--pylr-space-2)",
                    borderLeft: `3px solid ${active ? "var(--pylr-red)" : "transparent"}`,
                    color: active ? "var(--pylr-red)" : "var(--pylr-ink)",
                    fontWeight: active ? 700 : 500,
                    textDecoration: "none",
                    fontSize: "0.9rem",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        style={{
          borderTop: "var(--pylr-rule-width) solid var(--pylr-rule)",
          padding: "var(--pylr-space-3) var(--pylr-space-4)",
          display: "flex",
          alignItems: "center",
          gap: "var(--pylr-space-2)",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: "var(--pylr-rule-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "0.75rem",
            flexShrink: 0,
          }}
        >
          {userName
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{userName}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--pylr-ink-muted)" }}>{userRole}</div>
        </div>
        {userMenu}
      </div>
    </aside>
  );
}
