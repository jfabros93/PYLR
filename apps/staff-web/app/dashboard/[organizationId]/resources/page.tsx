import Link from "next/link";
import { Button, FormField, PageHeader, Select, Table, Td, TextInput, Th } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import type { Resource } from "@pylr/schemas";
import { createResourceAction } from "./actions";

export default async function ResourcesPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const resources = await apiFetch<Resource[]>(`/organizations/${organizationId}/resources`);
  const create = createResourceAction.bind(null, organizationId);

  return (
    <div>
      <PageHeader
        eyebrow="Org-admin only — teams request these through a booking request"
        title="Resources"
        actions={<Link href={`/dashboard/${organizationId}/resources/calendar`}>Week calendar →</Link>}
      />

      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Type</Th>
            <Th>Capacity</Th>
            <Th>Approval</Th>
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => (
            <tr key={r.id}>
              <Td>
                <Link href={`/dashboard/${organizationId}/resources/${r.id}`} style={{ fontWeight: 700 }}>
                  {r.name}
                </Link>
              </Td>
              <Td>{r.type}</Td>
              <Td>{r.capacity ?? "—"}</Td>
              <Td>{r.requiresApproval ? "Required" : "Not required"}</Td>
            </tr>
          ))}
          {resources.length === 0 && (
            <tr>
              <Td colSpan={4}>No resources yet — add one below.</Td>
            </tr>
          )}
        </tbody>
      </Table>

      <h2 style={{ fontSize: "1.1rem", margin: "var(--pylr-space-5) 0 var(--pylr-space-3)" }}>Add a resource</h2>
      <form action={create} style={{ display: "grid", gap: "var(--pylr-space-3)", maxWidth: 360 }}>
        <FormField label="Name">
          <TextInput name="name" placeholder="Sanctuary" required />
        </FormField>
        <FormField label="Type">
          <Select name="type" defaultValue="room">
            <option value="room">Room</option>
            <option value="equipment">Equipment</option>
            <option value="vehicle">Vehicle</option>
            <option value="other">Other</option>
          </Select>
        </FormField>
        <FormField label="Capacity (optional)">
          <TextInput name="capacity" type="number" min={1} />
        </FormField>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--pylr-space-2)", fontSize: "0.85rem" }}>
          <input name="requiresApproval" type="checkbox" defaultChecked /> Requires org-admin approval to book
        </label>
        <div>
          <Button type="submit" variant="primary">
            Add resource
          </Button>
        </div>
      </form>
    </div>
  );
}
