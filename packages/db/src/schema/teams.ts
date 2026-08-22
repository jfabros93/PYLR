import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { teamRoleEnum, teamTypeEnum } from "./enums.js";
import { campuses, organizations } from "./organizations.js";
import { users } from "./people.js";

// Ministries / sub-groups within a church: Youth Ministry, Worship Team,
// Men's Group, or an informal group that just meets on weekends. Every
// scheduling/booking feature is owned by a team, which is what lets the
// same system serve a Sunday main service and a small bible study alike.
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  campusId: uuid("campus_id").references(() => campuses.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  description: text("description"),
  type: teamTypeEnum("type").notNull().default("ministry"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Denormalized from teams.organization_id so RLS can scope this table
    // by a simple column comparison instead of a subquery join — kept in
    // sync by the application layer at insert time (see TeamsService).
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: teamRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("team_members_team_user_uq").on(table.teamId, table.userId),
  ],
);
