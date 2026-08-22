import Link from "next/link";
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

  return (
    <div>
      <p>
        <Link href={`/dashboard/${organizationId}/teams/${teamId}/services`}>← Services</Link>
      </p>
      <h1>
        {new Date(plan.serviceOccurrence.occursAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
      </h1>
      <p>
        {plan.serviceOccurrence.service.name} — <strong>{plan.status}</strong>
      </p>

      <form action={bound.updatePlan} style={{ display: "grid", gap: "0.5rem", maxWidth: 480, marginBottom: "1.5rem" }}>
        <input name="title" defaultValue={plan.title ?? ""} placeholder="Sermon series title" />
        <textarea name="notes" defaultValue={plan.notes ?? ""} placeholder="Internal planning notes" rows={3} />
        <button type="submit">Save</button>
      </form>

      {plan.status === "draft" && (
        <form action={bound.publish} style={{ marginBottom: "1.5rem" }}>
          <button type="submit">Publish plan</button>
        </form>
      )}

      {/* --- Speakers --- */}
      <section style={{ marginBottom: "2rem" }}>
        <h2>Speakers</h2>
        <ul>
          {plan.speakers.map((s) => (
            <li key={s.id}>
              {personLabel(s.person)} — {s.roleLabel}
              {s.sermonTitle && <> · “{s.sermonTitle}”</>}{" "}
              <form action={removeSpeakerAction.bind(null, organizationId, planId, s.id)} style={{ display: "inline" }}>
                <button type="submit">Remove</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={bound.addSpeaker} style={{ display: "grid", gap: "0.5rem", maxWidth: 420 }}>
          <select name="personId" defaultValue="">
            <option value="">— Guest (enter name below) —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {personLabel(p)}
              </option>
            ))}
          </select>
          <input name="guestFirstName" placeholder="Guest first name" />
          <input name="guestLastName" placeholder="Guest last name" />
          <input name="roleLabel" defaultValue="Preaching" />
          <input name="sermonTitle" placeholder="Sermon title" />
          <button type="submit">Add speaker</button>
        </form>
      </section>

      {/* --- Songs --- */}
      <section style={{ marginBottom: "2rem" }}>
        <h2>Set list</h2>
        <ul>
          {plan.songs.map((ps) => (
            <li key={ps.id}>
              <strong>{ps.song.title}</strong>
              {ps.song.artist && <> — {ps.song.artist}</>}
              {ps.key && <> ({ps.key})</>}{" "}
              <form action={removeSongAction.bind(null, organizationId, planId, ps.id)} style={{ display: "inline" }}>
                <button type="submit">Remove</button>
              </form>
              <ul>
                {ps.assignments.map((a) => (
                  <li key={a.id}>
                    {personLabel(a.person)} — {a.instrumentOrRole}
                  </li>
                ))}
              </ul>
              <form
                action={assignSongPersonAction.bind(null, organizationId, planId, ps.id)}
                style={{ display: "flex", gap: "0.5rem", maxWidth: 420 }}
              >
                <select name="personId" required>
                  <option value="">Person…</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {personLabel(p)}
                    </option>
                  ))}
                </select>
                <input name="instrumentOrRole" placeholder="Acoustic Guitar" required />
                <button type="submit">Assign</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={bound.addSong} style={{ display: "flex", gap: "0.5rem", maxWidth: 420 }}>
          <select name="songId" required>
            <option value="">Song…</option>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <input name="key" placeholder="Key (optional)" style={{ width: 100 }} />
          <button type="submit">Add to set list</button>
        </form>
        <details style={{ marginTop: "0.5rem" }}>
          <summary>Add a new song to the library</summary>
          <form action={bound.createSong} style={{ display: "grid", gap: "0.5rem", maxWidth: 360, marginTop: "0.5rem" }}>
            <input name="title" placeholder="Song title" required />
            <input name="artist" placeholder="Artist" />
            <input name="defaultKey" placeholder="Default key" style={{ width: 100 }} />
            <button type="submit">Add song</button>
          </form>
        </details>
      </section>

      {/* --- Announcements --- */}
      <section style={{ marginBottom: "2rem" }}>
        <h2>Announcements</h2>
        <ul>
          {plan.announcements.map((a) => (
            <li key={a.id}>
              <strong>{a.title}</strong> — {a.content}
              {a.assignedPerson && <> ({personLabel(a.assignedPerson)})</>}{" "}
              <form action={removeAnnouncementAction.bind(null, organizationId, planId, a.id)} style={{ display: "inline" }}>
                <button type="submit">Remove</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={bound.addAnnouncement} style={{ display: "grid", gap: "0.5rem", maxWidth: 420 }}>
          <input name="title" placeholder="Title" required />
          <textarea name="content" placeholder="Content" rows={2} required />
          <select name="assignedPersonId" defaultValue="">
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {personLabel(p)}
              </option>
            ))}
          </select>
          <button type="submit">Add announcement</button>
        </form>
      </section>

      {/* --- Serving-role grid --- */}
      <section style={{ marginBottom: "2rem" }}>
        <h2>Serving roles</h2>
        <ul>
          {plan.roleAssignments.map((ra) => (
            <li key={ra.id}>
              {ra.servingRole.name}: {personLabel(ra.person)} — <strong>{ra.status}</strong>{" "}
              <form
                action={updateAssignmentStatusAction.bind(null, organizationId, planId, ra.id, "confirmed")}
                style={{ display: "inline" }}
              >
                <button type="submit">Confirm</button>
              </form>{" "}
              <form
                action={updateAssignmentStatusAction.bind(null, organizationId, planId, ra.id, "declined")}
                style={{ display: "inline" }}
              >
                <button type="submit">Decline</button>
              </form>{" "}
              <form action={removeRoleAssignmentAction.bind(null, organizationId, planId, ra.id)} style={{ display: "inline" }}>
                <button type="submit">Remove</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={bound.addRole} style={{ display: "flex", gap: "0.5rem", maxWidth: 480 }}>
          <select name="servingRoleId" required>
            <option value="">Role…</option>
            {servingRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select name="personId">
            <option value="">Open slot</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {personLabel(p)}
              </option>
            ))}
          </select>
          <button type="submit">Assign</button>
        </form>
      </section>

      <details>
        <summary>Add a new person</summary>
        <form action={bound.createPerson} style={{ display: "grid", gap: "0.5rem", maxWidth: 360, marginTop: "0.5rem" }}>
          <input name="firstName" placeholder="First name" required />
          <input name="lastName" placeholder="Last name" />
          <input name="email" type="email" placeholder="Email (optional)" />
          <button type="submit">Add person</button>
        </form>
      </details>
    </div>
  );
}
