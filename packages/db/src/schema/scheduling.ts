import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  occurrenceStatusEnum,
  planStatusEnum,
  roleAssignmentStatusEnum,
} from "./enums.js";
import { organizations } from "./organizations.js";
import { people, users } from "./people.js";
import { teams } from "./teams.js";

// Service (the recurring or one-off *concept* of a gathering, owned by a
// team) -> ServiceOccurrence (one dated instance) -> Plan (the lineup for
// that instance). Deliberately has no resource/room reference yet —
// that's `default_resource_id`/`resource_id` from docs/ARCHITECTURE.md,
// added once the `resources` table exists in Phase 2.
export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // iCal RRULE, e.g. "FREQ=WEEKLY;BYDAY=SU" — null for a one-off service.
  // Phase 1 occurrence generation only exercises simple weekly/biweekly
  // patterns; see OccurrencesService.
  recurrenceRule: text("recurrence_rule"),
  defaultTime: text("default_time"), // "HH:MM", org-local wall-clock time
  defaultDurationMinutes: integer("default_duration_minutes").notNull().default(90),
  // Whether occurrences of this service are eligible to be promoted to
  // the congregant app (Phase 3) — a Sunday service: yes; a leadership
  // prayer meeting: no.
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serviceOccurrences = pgTable(
  "service_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    // Denormalized from services.teamId — see TeamMember's organizationId
    // column for the same rationale: lets ability checks and queries key
    // off a plain column instead of a join.
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    occursAt: timestamp("occurs_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    status: occurrenceStatusEnum("status").notNull().default("scheduled"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("service_occurrences_service_time_uq").on(table.serviceId, table.occursAt)],
);

// The lineup/content for one occurrence — 1:1, split into its own table
// (rather than columns on service_occurrences) for clean draft/published
// versioning and so team members without occurrence-scheduling rights can
// still be granted plan-editing rights independently later.
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  serviceOccurrenceId: uuid("service_occurrence_id")
    .notNull()
    .unique()
    .references(() => serviceOccurrences.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  title: text("title"), // e.g. sermon series title
  notes: text("notes"), // internal planning notes
  status: planStatusEnum("status").notNull().default("draft"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Preacher/speaker assignment — supports co-speakers via `order`.
// References `people`, not `users`, so a guest speaker with no login
// still works (see AddSpeakerInput).
export const planSpeakers = pgTable("plan_speakers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  personId: uuid("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  roleLabel: text("role_label").notNull().default("Preaching"), // e.g. "Preaching", "Guest Speaker"
  sermonTitle: text("sermon_title"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Org-level song library, reusable across plans and teams.
export const songs = pgTable("songs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  artist: text("artist"),
  defaultKey: text("default_key"),
  ccliNumber: text("ccli_number"),
  chartUrl: text("chart_url"),
  lyricsUrl: text("lyrics_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// The set list — one row per song on a plan.
export const planSongs = pgTable("plan_songs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  songId: uuid("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  key: text("key"), // overrides the song's defaultKey for this occurrence
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Who's playing/leading each song — separate from plan_songs so multiple
// people can be assigned per song (e.g. two guitarists).
export const planSongAssignments = pgTable(
  "plan_song_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    planSongId: uuid("plan_song_id")
      .notNull()
      .references(() => planSongs.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    instrumentOrRole: text("instrument_or_role").notNull(), // e.g. "Acoustic Guitar", "Vocals - Lead"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plan_song_assignments_uq").on(table.planSongId, table.personId, table.instrumentOrRole),
  ],
);

export const planAnnouncements = pgTable("plan_announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  assignedPersonId: uuid("assigned_person_id").references(() => people.id, { onDelete: "set null" }),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Org-level extensible definition of role *types* ("Sound Tech",
// "Greeter", "Worship Leader") since needs vary per team. teamId nullable
// = available org-wide; set = specific to that team (e.g. only Youth has
// "Game Leader").
export const servingRoles = pgTable(
  "serving_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    icon: text("icon"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("serving_roles_org_slug_uq").on(table.organizationId, table.slug)],
);

// The generalized "serving roles grid" — rows = serving_roles, columns =
// people/status. This single table covers worship leader, sound tech,
// greeter, camera op, etc.; a team just defines whatever serving_roles it
// needs. personId nullable = an open slot needing to be filled. A plain
// (not partial) unique index on (planId, servingRoleId, personId) is
// sufficient to prevent double-inviting the same person to the same role
// twice, since Postgres never treats two NULLs as equal in a unique index
// — multiple open slots for the same role coexist fine.
export const planRoleAssignments = pgTable(
  "plan_role_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    servingRoleId: uuid("serving_role_id")
      .notNull()
      .references(() => servingRoles.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => people.id, { onDelete: "cascade" }),
    status: roleAssignmentStatusEnum("status").notNull().default("invited"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plan_role_assignments_uq").on(table.planId, table.servingRoleId, table.personId),
  ],
);
