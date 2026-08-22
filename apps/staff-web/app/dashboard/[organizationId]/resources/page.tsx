import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Resource } from "@pylr/schemas";
import { createResourceAction } from "./actions";

export default async function ResourcesPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const resources = await apiFetch<Resource[]>(`/organizations/${organizationId}/resources`);
  const create = createResourceAction.bind(null, organizationId);

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}`}>← Dashboard</Link>
      </p>
      <h1>Resources</h1>
      <p>
        <small>
          Bookable spaces and equipment (sanctuary, fellowship hall, the projector). Org-admin only — teams request
          these through a booking request.
        </small>
      </p>
      <ul>
        {resources.map((r) => (
          <li key={r.id}>
            <Link href={`/dashboard/${organizationId}/resources/${r.id}`}>{r.name}</Link>{" "}
            <small>
              ({r.type}
              {r.capacity ? `, capacity ${r.capacity}` : ""}
              {r.requiresApproval ? "" : ", no approval required"})
            </small>
          </li>
        ))}
        {resources.length === 0 && <li>No resources yet — add one below.</li>}
      </ul>

      <h2>Add a resource</h2>
      <form action={create} style={{ display: "grid", gap: "0.5rem", maxWidth: 360 }}>
        <label>
          Name
          <input name="name" placeholder="Sanctuary" required style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          Type
          <select name="type" defaultValue="room" style={{ display: "block", width: "100%" }}>
            <option value="room">Room</option>
            <option value="equipment">Equipment</option>
            <option value="vehicle">Vehicle</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Capacity (optional)
          <input name="capacity" type="number" min={1} style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          <input name="requiresApproval" type="checkbox" defaultChecked /> Requires org-admin approval to book
        </label>
        <button type="submit">Add resource</button>
      </form>
    </div>
  );
}
