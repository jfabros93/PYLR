import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "accent";
}

/** One number in the dashboard's stat row — label small/uppercase/muted, value big and bold. */
export function StatTile({ label, value, sub, tone = "default" }: StatTileProps) {
  return (
    <div
      style={{
        border: "var(--pylr-rule-width) solid var(--pylr-rule)",
        borderLeft: "none",
        padding: "var(--pylr-space-4)",
        flex: "1 1 160px",
      }}
    >
      <div
        style={{
          textTransform: "uppercase",
          fontSize: "0.7rem",
          letterSpacing: "0.04em",
          color: "var(--pylr-ink-muted)",
          marginBottom: "var(--pylr-space-1)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--pylr-font-display, inherit)",
          fontWeight: 800,
          fontSize: "2.25rem",
          lineHeight: 1,
          color: tone === "accent" ? "var(--pylr-red)" : "var(--pylr-ink)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.8rem", color: "var(--pylr-ink-muted)", marginTop: "var(--pylr-space-1)" }}>{sub}</div>
      )}
    </div>
  );
}

/** Wraps a row of StatTiles with the shared left border the row needs (each tile skips its own left border). */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", borderLeft: "var(--pylr-rule-width) solid var(--pylr-rule)" }}>
      {children}
    </div>
  );
}
