type Tone = "neutral" | "positive" | "attention" | "muted";

const tones: Record<Tone, { border: string; color: string; background: string }> = {
  neutral: { border: "var(--pylr-ink)", color: "var(--pylr-ink)", background: "var(--pylr-surface)" },
  positive: { border: "var(--pylr-rule-light)", color: "var(--pylr-ink-muted)", background: "#eef1ee" },
  attention: { border: "var(--pylr-red)", color: "var(--pylr-red)", background: "#fdeceb" },
  muted: { border: "var(--pylr-rule-light)", color: "var(--pylr-ink-faint)", background: "var(--pylr-surface)" },
};

// Maps the statuses that actually exist across the app (plans, occurrences,
// role assignments, booking requests) to a tone. Anything not listed falls
// back to "neutral" rather than throwing — new enum values degrade
// gracefully instead of crashing a page.
const statusTone: Record<string, Tone> = {
  draft: "muted",
  published: "positive",
  scheduled: "neutral",
  cancelled: "muted",
  invited: "muted",
  confirmed: "positive",
  declined: "attention",
  pending: "attention",
  approved: "positive",
  denied: "attention",
  changes_requested: "attention",
};

interface BadgeProps {
  children: string;
  tone?: Tone;
}

/** A small status pill — pass a known status string and it colors itself, or pass an explicit `tone`. */
export function Badge({ children, tone }: BadgeProps) {
  const resolved = tones[tone ?? statusTone[children] ?? "neutral"];
  return (
    <span
      style={{
        display: "inline-block",
        border: `1px solid ${resolved.border}`,
        color: resolved.color,
        background: resolved.background,
        padding: "0.15rem 0.5rem",
        fontSize: "0.75rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {children.replace(/_/g, " ")}
    </span>
  );
}
