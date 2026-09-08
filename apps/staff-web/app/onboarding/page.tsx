import { Button, FormField, TextInput } from "@pylr/ui";
import { createOrganizationAction } from "./actions";

export default function OnboardingPage() {
  return (
    <div style={{ maxWidth: 480, margin: "3rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontFamily: "var(--pylr-font-display)", fontSize: "1.75rem", marginBottom: "var(--pylr-space-4)" }}>
        Create your church&apos;s workspace
      </h1>
      <form action={createOrganizationAction} style={{ display: "grid", gap: "var(--pylr-space-3)" }}>
        <FormField label="Church name">
          <TextInput name="name" required minLength={2} />
        </FormField>
        <FormField label="URL slug" hint="Used in public URLs, e.g. pylr.app/{slug}/events">
          <TextInput name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="grace-community" />
        </FormField>
        <FormField label="Timezone">
          <TextInput name="timezone" defaultValue="America/New_York" />
        </FormField>
        <div>
          <Button type="submit" variant="primary">
            Create workspace
          </Button>
        </div>
      </form>
    </div>
  );
}
