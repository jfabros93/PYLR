import Link from "next/link";
import { Button, FormField, PageHeader, Select, Table, Td, TextInput, Th } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import type { Team } from "@pylr/schemas";
import { createTeamAction } from "./actions";

export default async function TeamsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const teams = await apiFetch<Team[]>(`/organizations/${organizationId}/teams`);
  const create = createTeamAction.bind(null, organizationId);

  return (
    <div>
      <PageHeader eyebrow="Schedule" title="Teams" />

      <Table>
        <thead>
          <tr>
            <Th>Team</Th>
            <Th>Type</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id}>
              <Td>
                <Link href={`/dashboard/${organizationId}/teams/${t.id}/services`} style={{ fontWeight: 700 }}>
                  {t.name}
                </Link>
              </Td>
              <Td>{t.type}</Td>
              <Td>
                <Link href={`/dashboard/${organizationId}/teams/${t.id}/booking-requests`}>Book a resource →</Link>
              </Td>
            </tr>
          ))}
          {teams.length === 0 && (
            <tr>
              <Td colSpan={3}>No teams yet — create one below.</Td>
            </tr>
          )}
        </tbody>
      </Table>

      <h2 style={{ fontSize: "1.1rem", margin: "var(--pylr-space-5) 0 var(--pylr-space-3)" }}>Create a team</h2>
      <form action={create} style={{ display: "grid", gap: "var(--pylr-space-3)", maxWidth: 360 }}>
        <FormField label="Name">
          <TextInput name="name" placeholder="Worship Team" required />
        </FormField>
        <FormField label="Type">
          <Select name="type" defaultValue="ministry">
            <option value="ministry">Ministry</option>
            <option value="small_group">Small group</option>
            <option value="staff_team">Staff team</option>
            <option value="informal">Informal</option>
          </Select>
        </FormField>
        <div>
          <Button type="submit" variant="primary">
            Create team
          </Button>
        </div>
      </form>
    </div>
  );
}
