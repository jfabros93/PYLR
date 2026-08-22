import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { bookingRequestStatusEnum } from "./enums.js";
import { organizations } from "./organizations.js";
import { users } from "./people.js";
import { resources } from "./resources.js";
import { serviceOccurrences } from "./scheduling.js";
import { teams } from "./teams.js";

// Event Planner (Phase 2): a team requests a resource for a time range;
// org_admin approves/denies/requests changes. Conflict prevention is a
// Postgres exclusion constraint, NOT modeled here — Drizzle can't express
// `GENERATED ALWAYS ... STORED` or `EXCLUDE USING gist`, so the `during`
// generated column and the `no_overlapping_approved_bookings` constraint
// are hand-written in migrations/0006_booking_rls.sql. Only APPROVED rows
// participate in that constraint — pending requests never reject each
// other; staff see contention and choose (docs/ARCHITECTURE.md).
export const bookingRequests = pgTable("booking_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  requestingTeamId: uuid("requesting_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  // No onDelete cascade: a resource with existing booking history can't be
  // deleted out from under it — ResourcesService.deleteResource turns the
  // resulting FK violation into a 409 instead.
  resourceId: uuid("resource_id")
    .notNull()
    .references(() => resources.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  purpose: text("purpose"),
  status: bookingRequestStatusEnum("status").notNull().default("pending"),
  // Unifies a recurring service occurrence's room booking and an ad-hoc
  // event booking under the same conflict-check mechanism.
  relatedServiceOccurrenceId: uuid("related_service_occurrence_id").references(
    () => serviceOccurrences.id,
    { onDelete: "set null" },
  ),
  // No `events` table exists yet (Phase 3 — "promoted to a public events
  // row"). Nullable, deliberately NOT a foreign key yet: add
  // `.references(() => events.id, { onDelete: "set null" })` once Phase 3
  // creates that table.
  relatedEventId: uuid("related_event_id"),
  requestedByUserId: uuid("requested_by_user_id")
    .notNull()
    .references(() => users.id),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
