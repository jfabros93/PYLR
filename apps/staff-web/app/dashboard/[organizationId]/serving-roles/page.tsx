import { Button, PageHeader, Table, Td, TextInput, Th } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import type { ServingRole } from "@pylr/schemas";
import { createServingRoleAction } from "./actions";

export default async function ServingRolesPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const roles = await apiFetch<ServingRole[]>(`/organizations/${organizationId}/serving-roles`);
  const create = createServingRoleAction.bind(null, organizationId);

  return (
    <div>
      <PageHeader
        eyebrow="Org-admin only — team leaders fill these in on individual plans"
        title="Serving Roles"
      />

      <Table>
        <thead>
          <tr>
            <Th>Role</Th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <Td>{r.name}</Td>
            </tr>
          ))}
          {roles.length === 0 && (
            <tr>
              <Td>No serving roles yet — create one below.</Td>
            </tr>
          )}
        </tbody>
      </Table>

      <form action={create} style={{ display: "flex", gap: "var(--pylr-space-2)", maxWidth: 360, marginTop: "var(--pylr-space-4)" }}>
        <TextInput name="name" placeholder="Sound Tech" required />
        <Button type="submit" variant="primary">
          Add role
        </Button>
      </form>
    </div>
  );
}
