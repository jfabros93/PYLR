import { createOrganizationAction } from "./actions";

export default function OnboardingPage() {
  return (
    <div style={{ maxWidth: 480 }}>
      <h1>Create your church&apos;s workspace</h1>
      <form action={createOrganizationAction} style={{ display: "grid", gap: "0.75rem" }}>
        <label>
          Church name
          <input name="name" required minLength={2} style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          URL slug
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="grace-community"
            style={{ display: "block", width: "100%" }}
          />
          <small>Used in public URLs, e.g. pylr.app/{"{slug}"}/events</small>
        </label>
        <label>
          Timezone
          <input name="timezone" defaultValue="America/New_York" style={{ display: "block", width: "100%" }} />
        </label>
        <button type="submit">Create workspace</button>
      </form>
    </div>
  );
}
