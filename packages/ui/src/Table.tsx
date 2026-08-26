import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/** A ruled data table — thin row dividers, uppercase muted column headers. Use the plain `<table>` structure with these cell components. */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table>{children}</table>
    </div>
  );
}

export function Th({ children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      style={{
        textAlign: "left",
        textTransform: "uppercase",
        fontSize: "0.7rem",
        letterSpacing: "0.04em",
        color: "var(--pylr-ink-muted)",
        fontWeight: 700,
        padding: "var(--pylr-space-2) var(--pylr-space-3)",
        borderBottom: "var(--pylr-rule-width) solid var(--pylr-rule)",
      }}
    >
      {children}
    </th>
  );
}

export function Td({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...props}
      style={{
        padding: "var(--pylr-space-3)",
        borderBottom: "1px solid var(--pylr-rule-light)",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}
