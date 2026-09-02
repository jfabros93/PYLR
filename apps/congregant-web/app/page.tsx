// Placeholder landing page — Phase 3/4 (public events, ticketing, giving)
// builds this out for real. See docs/ARCHITECTURE.md's phased roadmap.
export default function HomePage() {
  return (
    <main style={{ padding: "var(--pylr-space-6)", maxWidth: 640 }}>
      <div style={{ fontFamily: "var(--pylr-font-display)", fontWeight: 800, fontSize: "1.5rem", marginBottom: "var(--pylr-space-4)" }}>
        <span style={{ display: "inline-block", width: 14, height: 14, background: "var(--pylr-red)", marginRight: "0.4rem" }} />
        PYLR
      </div>
      <p style={{ color: "var(--pylr-ink-muted)" }}>
        This is the placeholder for the congregant-facing app — public events, ticketing, and giving land here in
        Phase 3–4. Try a church&apos;s page at <code>/c/[slug]</code>.
      </p>
    </main>
  );
}
