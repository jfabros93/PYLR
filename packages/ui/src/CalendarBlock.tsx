interface CalendarBlockProps {
  status: "approved" | "pending";
  timeLabel: string;
  title: string;
  subtitle?: string;
}

/**
 * One booking on a resource-calendar grid (mockup 1e): solid dark for an
 * approved booking, red-hatched for a pending one — pending never blocks
 * the grid the way approved does, so the styling deliberately looks
 * "provisional" rather than solid.
 */
export function CalendarBlock({ status, timeLabel, title, subtitle }: CalendarBlockProps) {
  const pending = status === "pending";
  return (
    <div
      style={{
        border: `1px solid ${pending ? "var(--pylr-red)" : "var(--pylr-ink)"}`,
        background: pending
          ? "repeating-linear-gradient(45deg, #fdeceb, #fdeceb 6px, #fff 6px, #fff 12px)"
          : "var(--pylr-ink)",
        color: pending ? "var(--pylr-red)" : "#fff",
        padding: "0.3rem 0.4rem",
        fontSize: "0.75rem",
        marginBottom: "0.25rem",
      }}
    >
      <div style={{ fontWeight: 700 }}>
        {timeLabel} {title}
      </div>
      {subtitle && <div style={{ opacity: 0.85 }}>{subtitle}</div>}
    </div>
  );
}
