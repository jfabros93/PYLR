import Link from "next/link";
import { Badge, Button, FormField, Select, TextInput, Textarea } from "@pylr/ui";
import { apiFetch } from "@/lib/api";
import type { Person, PlanDetail, Song, ServingRole } from "@pylr/schemas";
import {
  addAnnouncementAction,
  addRoleAssignmentAction,
  addSongToPlanAction,
  addSpeakerAction,
  assignSongPersonAction,
  createPersonAction,
  createSongAction,
  publishPlanAction,
  removeAnnouncementAction,
  removeRoleAssignmentAction,
  removeSongAction,
  removeSpeakerAction,
  updateAssignmentStatusAction,
  updatePlanAction,
} from "./actions";

function personLabel(p: { firstName: string; lastName: string | null } | null) {
  if (!p) return "(open slot)";
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

const sectionStyle = { marginBottom: "var(--pylr-space-6)" };
const sectionHeadingStyle = { fontSize: "1rem", marginBottom: "var(--pylr-space-3)" };
const rowStyle = {
  padding: "var(--pylr-space-2) 0",
  borderBottom: "1px solid var(--pylr-rule-light)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "var(--pylr-space-3)",
};

export default async function PlanBuilderPage({
  params,
}: {
  params: Promise<{ organizationId: string; planId: string }>;
}) {
  const { organizationId, planId } = await params;
  const [plan, songs, servingRoles, people] = await Promise.all([
    apiFetch<PlanDetail>(`/organizations/${organizationId}/plans/${planId}`),
    apiFetch<Song[]>(`/organizations/${organizationId}/songs`),
    apiFetch<ServingRole[]>(`/organizations/${organizationId}/serving-roles`),
    apiFetch<Person[]>(`/organizations/${organizationId}/people`),
  ]);

  const teamId = plan.serviceOccurrence.service.teamId;
  const bound = {
    updatePlan: updatePlanAction.bind(null, organizationId, planId),
    publish: publishPlanAction.bind(null, organizationId, planId),
    addSpeaker: addSpeakerAction.bind(null, organizationId, planId),
    createSong: createSongAction.bind(null, organizationId),
    addSong: addSongToPlanAction.bind(null, organizationId, planId),
    addAnnouncement: addAnnouncementAction.bind(null, organizationId, planId),
    addRole: addRoleAssignmentAction.bind(null, organizationId, planId),
    createPerson: createPersonAction.bind(null, organizationId, planId),
  };

  const filled = plan.roleAssignments.filter((r) => r.person).length;

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}/teams/${teamId}/services`}>← Services</Link>
      </p>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "var(--pylr-space-3)",
          flexWrap: "wrap",
          marginBottom: "var(--pylr-space-2)",
        }}
      >
        <div>
          <div style={{ textTransform: "uppercase", fontSize: "0.75rem", color: "var(--pylr-ink-muted)" }}>
            {plan.serviceOccurrence.service.name}
          </div>
          <h1 style={{ fontFamily: "var(--pylr-font-display, inherit)", fontSize: "1.9rem" }}>
            {new Date(plan.serviceOccurrence.occursAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "var(--pylr-space-2)", alignItems: "center" }}>
          <Badge>{plan.status}</Badge>
          {plan.status === "draft" && (
            <form action={bound.publish}>
              <Button type="submit" variant="primary">
                Publish plan
              </Button>
            </form>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--pylr-space-6)", alignItems: "start" }}>
        <div>
          <form action={bound.updatePlan} style={{ display: "grid", gap: "var(--pylr-space-3)", marginBottom: "var(--pylr-space-6)" }}>
            <FormField label="Title">
              <TextInput name="title" defaultValue={plan.title ?? ""} placeholder="Sermon series title" />
            </FormField>
            <FormField label="Internal notes">
              <Textarea name="notes" defaultValue={plan.notes ?? ""} rows={3} />
            </FormField>
            <div>
              <Button type="submit">Save</Button>
            </div>
          </form>

          {/* --- Speakers --- */}
          <section style={sectionStyle}>
            <h2 style={sectionHeadingStyle}>Speakers</h2>
            {plan.speakers.map((s) => (
              <div key={s.id} style={rowStyle}>
                <div>
                  <strong>{personLabel(s.person)}</strong> — {s.roleLabel}
                  {s.sermonTitle && <> · “{s.sermonTitle}”</>}
                </div>
                <form action={removeSpeakerAction.bind(null, organizationId, planId, s.id)}>
                  <Button type="submit">Remove</Button>
                </form>
              </div>
            ))}
            {plan.speakers.length === 0 && <p style={{ color: "var(--pylr-ink-muted)" }}>No speakers yet.</p>}
            <form action={bound.addSpeaker} style={{ display: "grid", gap: "var(--pylr-space-2)", maxWidth: 420, marginTop: "var(--pylr-space-3)" }}>
              <Select name="personId" defaultValue="">
                <option value="">— Guest (enter name below) —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(p)}
                  </option>
                ))}
              </Select>
              <TextInput name="guestFirstName" placeholder="Guest first name" />
              <TextInput name="guestLastName" placeholder="Guest last name" />
              <TextInput name="roleLabel" defaultValue="Preaching" />
              <TextInput name="sermonTitle" placeholder="Sermon title" />
              <div>
                <Button type="submit">Add speaker</Button>
              </div>
            </form>
          </section>

          {/* --- Songs --- */}
          <section style={sectionStyle}>
            <h2 style={sectionHeadingStyle}>Set list</h2>
            {plan.songs.map((ps) => (
              <div key={ps.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <strong>{ps.song.title}</strong>
                    {ps.song.artist && <> — {ps.song.artist}</>}
                    {ps.key && <> ({ps.key})</>}
                  </div>
                  <form action={removeSongAction.bind(null, organizationId, planId, ps.id)}>
                    <Button type="submit">Remove</Button>
                  </form>
                </div>
                <ul style={{ margin: "var(--pylr-space-1) 0", paddingLeft: "1.2rem", color: "var(--pylr-ink-muted)", fontSize: "0.9rem" }}>
                  {ps.assignments.map((a) => (
                    <li key={a.id}>
                      {personLabel(a.person)} — {a.instrumentOrRole}
                    </li>
                  ))}
                </ul>
                <form
                  action={assignSongPersonAction.bind(null, organizationId, planId, ps.id)}
                  style={{ display: "flex", gap: "var(--pylr-space-2)", maxWidth: 420 }}
                >
                  <Select name="personId" required>
                    <option value="">Person…</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {personLabel(p)}
                      </option>
                    ))}
                  </Select>
                  <TextInput name="instrumentOrRole" placeholder="Acoustic Guitar" required />
                  <Button type="submit">Assign</Button>
                </form>
              </div>
            ))}
            {plan.songs.length === 0 && <p style={{ color: "var(--pylr-ink-muted)" }}>No songs yet.</p>}
            <form action={bound.addSong} style={{ display: "flex", gap: "var(--pylr-space-2)", maxWidth: 420, marginTop: "var(--pylr-space-3)" }}>
              <Select name="songId" required>
                <option value="">Song…</option>
                {songs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </Select>
              <TextInput name="key" placeholder="Key" style={{ width: 90 }} />
              <Button type="submit">Add to set list</Button>
            </form>
            <details style={{ marginTop: "var(--pylr-space-2)" }}>
              <summary style={{ cursor: "pointer", color: "var(--pylr-ink-muted)" }}>Add a new song to the library</summary>
              <form action={bound.createSong} style={{ display: "grid", gap: "var(--pylr-space-2)", maxWidth: 360, marginTop: "var(--pylr-space-2)" }}>
                <TextInput name="title" placeholder="Song title" required />
                <TextInput name="artist" placeholder="Artist" />
                <TextInput name="defaultKey" placeholder="Default key" style={{ width: 100 }} />
                <div>
                  <Button type="submit">Add song</Button>
                </div>
              </form>
            </details>
          </section>

          {/* --- Announcements --- */}
          <section style={sectionStyle}>
            <h2 style={sectionHeadingStyle}>Announcements</h2>
            {plan.announcements.map((a) => (
              <div key={a.id} style={rowStyle}>
                <div>
                  <strong>{a.title}</strong> — {a.content}
                  {a.assignedPerson && <> ({personLabel(a.assignedPerson)})</>}
                </div>
                <form action={removeAnnouncementAction.bind(null, organizationId, planId, a.id)}>
                  <Button type="submit">Remove</Button>
                </form>
              </div>
            ))}
            {plan.announcements.length === 0 && <p style={{ color: "var(--pylr-ink-muted)" }}>No announcements yet.</p>}
            <form action={bound.addAnnouncement} style={{ display: "grid", gap: "var(--pylr-space-2)", maxWidth: 420, marginTop: "var(--pylr-space-3)" }}>
              <TextInput name="title" placeholder="Title" required />
              <Textarea name="content" placeholder="Content" rows={2} required />
              <Select name="assignedPersonId" defaultValue="">
                <option value="">Unassigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(p)}
                  </option>
                ))}
              </Select>
              <div>
                <Button type="submit">Add announcement</Button>
              </div>
            </form>
          </section>

          <details>
            <summary style={{ cursor: "pointer", color: "var(--pylr-ink-muted)" }}>Add a new person</summary>
            <form action={bound.createPerson} style={{ display: "grid", gap: "var(--pylr-space-2)", maxWidth: 360, marginTop: "var(--pylr-space-2)" }}>
              <TextInput name="firstName" placeholder="First name" required />
              <TextInput name="lastName" placeholder="Last name" />
              <TextInput name="email" type="email" placeholder="Email (optional)" />
              <div>
                <Button type="submit">Add person</Button>
              </div>
            </form>
          </details>
        </div>

        {/* --- Serving-role grid (right rail) --- */}
        <div style={{ border: "var(--pylr-rule-width) solid var(--pylr-rule)", padding: "var(--pylr-space-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--pylr-space-3)" }}>
            <h2 style={{ fontSize: "1.1rem" }}>Serving roles</h2>
            <span style={{ fontSize: "0.8rem", color: "var(--pylr-ink-muted)" }}>
              {filled} of {plan.roleAssignments.length} filled
            </span>
          </div>
          {plan.roleAssignments.map((ra) => (
            <div key={ra.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: "var(--pylr-space-1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{ra.servingRole.name}</strong>
                <Badge>{ra.status}</Badge>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--pylr-ink-muted)" }}>{personLabel(ra.person)}</div>
              <div style={{ display: "flex", gap: "var(--pylr-space-2)" }}>
                <form action={updateAssignmentStatusAction.bind(null, organizationId, planId, ra.id, "confirmed")}>
                  <Button type="submit">Confirm</Button>
                </form>
                <form action={updateAssignmentStatusAction.bind(null, organizationId, planId, ra.id, "declined")}>
                  <Button type="submit">Decline</Button>
                </form>
                <form action={removeRoleAssignmentAction.bind(null, organizationId, planId, ra.id)}>
                  <Button type="submit">Remove</Button>
                </form>
              </div>
            </div>
          ))}
          <form action={bound.addRole} style={{ display: "grid", gap: "var(--pylr-space-2)", marginTop: "var(--pylr-space-3)" }}>
            <Select name="servingRoleId" required>
              <option value="">Role…</option>
              {servingRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Select name="personId">
              <option value="">Open slot</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {personLabel(p)}
                </option>
              ))}
            </Select>
            <Button type="submit">+ Add serving role</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
