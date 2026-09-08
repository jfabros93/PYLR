import { SignIn } from "@clerk/nextjs";

// Split hero (mockup 1k): a red panel making the pitch, Clerk's own
// sign-in form on the right, restyled via `appearance` rather than
// fighting Clerk's DOM. This route is already public in proxy.ts's
// matcher (`/sign-in(.*)`).
export default function SignInPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <div
        style={{
          flex: "1 1 45%",
          background: "var(--pylr-red)",
          color: "var(--pylr-red-ink)",
          padding: "var(--pylr-space-8)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontFamily: "var(--pylr-font-display)", fontWeight: 800, fontSize: "1.5rem" }}>PYLR</div>
        <div>
          <h1 style={{ fontFamily: "var(--pylr-font-display)", fontSize: "2.75rem", lineHeight: 1.05, marginBottom: "var(--pylr-space-4)" }}>
            Everything your church schedules, in one place.
          </h1>
          <p style={{ maxWidth: 420, opacity: 0.9 }}>
            Services and plans, room bookings and approvals, public events and giving.
          </p>
        </div>
        <div style={{ fontSize: "0.85rem", opacity: 0.75 }}>One login, every church you serve at.</div>
      </div>

      <div style={{ flex: "1 1 55%", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--pylr-space-6)" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "var(--pylr-space-4)" }}>Sign in</h2>
          <SignIn
            appearance={{
              variables: {
                colorPrimary: "#ec3013",
                colorForeground: "#201e1d",
                borderRadius: "0px",
              },
              elements: {
                card: { boxShadow: "none", padding: 0 },
                headerTitle: { display: "none" },
                headerSubtitle: { display: "none" },
                formButtonPrimary: { fontWeight: 700, textTransform: "none" },
                socialButtonsBlockButton: { borderRadius: 0, borderWidth: "2px" },
                formFieldInput: { borderRadius: 0, borderWidth: "2px" },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
