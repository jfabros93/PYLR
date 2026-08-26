import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  variant?: "default" | "attention";
  children: ReactNode;
}

/**
 * A bordered content block. `attention` (red border + tinted background)
 * is for things that need the viewer to act — a booking conflict, a
 * declined assignment — never used decoratively.
 */
export function Panel({ title, variant = "default", children }: PanelProps) {
  const attention = variant === "attention";
  return (
    <div
      style={{
        border: `var(--pylr-rule-width) solid ${attention ? "var(--pylr-red)" : "var(--pylr-rule)"}`,
        background: attention ? "#fdeceb" : "var(--pylr-surface)",
        padding: "var(--pylr-space-4)",
      }}
    >
      {title && (
        <div
          style={{
            textTransform: "uppercase",
            fontSize: "0.75rem",
            letterSpacing: "0.04em",
            fontWeight: 700,
            color: attention ? "var(--pylr-red)" : "var(--pylr-ink-muted)",
            marginBottom: "var(--pylr-space-2)",
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
