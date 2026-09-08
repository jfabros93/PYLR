import { PageHeader, Table, Th, Td, FormField, TextInput, Button } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import type { Person } from "@pylr/schemas";
import { createPersonAction } from "./actions";

export default async function PeoplePage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const people = await apiFetch<Person[]>(`/organizations/${organizationId}/people`);
  const create = createPersonAction.bind(null, organizationId);

  return (
    <div>
      <PageHeader eyebrow={`${people.length} people`} title="People" />

      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th>Login</Th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <Td>
                {p.firstName} {p.lastName ?? ""}
              </Td>
              <Td>{p.email ?? "—"}</Td>
              <Td>{p.phone ?? "—"}</Td>
              <Td>{p.userId ? "Active" : "No login"}</Td>
            </tr>
          ))}
          {people.length === 0 && (
            <tr>
              <Td colSpan={4}>No one added yet — add someone below.</Td>
            </tr>
          )}
        </tbody>
      </Table>

      <h2 style={{ fontSize: "1.1rem", margin: "var(--pylr-space-5) 0 var(--pylr-space-3)" }}>Add a person</h2>
      <form
        action={create}
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--pylr-space-3)", maxWidth: 480 }}
      >
        <FormField label="First name">
          <TextInput name="firstName" required />
        </FormField>
        <FormField label="Last name">
          <TextInput name="lastName" />
        </FormField>
        <FormField label="Email">
          <TextInput name="email" type="email" />
        </FormField>
        <FormField label="Phone">
          <TextInput name="phone" />
        </FormField>
        <div style={{ gridColumn: "1 / -1" }}>
          <Button type="submit" variant="primary">
            Add person
          </Button>
        </div>
      </form>
    </div>
  );
}
