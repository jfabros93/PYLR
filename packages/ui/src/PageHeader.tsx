import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}

/** Eyebrow label + big title + trailing action buttons — the top of every dashboard page. */
export function PageHeader({ eyebrow, title, actions }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: "var(--pylr-space-4)",
        flexWrap: "wrap",
        marginBottom: "var(--pylr-space-5)",
      }}
    >
      <div>
        {eyebrow && (
          <div
            style={{
              textTransform: "uppercase",
              fontSize: "0.75rem",
              letterSpacing: "0.04em",
              color: "var(--pylr-ink-muted)",
              marginBottom: "var(--pylr-space-1)",
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontFamily: "var(--pylr-font-display, inherit)", fontSize: "2rem" }}>{title}</h1>
      </div>
      {actions && <div style={{ display: "flex", gap: "var(--pylr-space-2)", flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}
