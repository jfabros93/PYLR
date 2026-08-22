import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { resourceTypeEnum } from "./enums.js";
import { organizations } from "./organizations.js";

// Bookable spaces/equipment (sanctuary, fellowship hall, the projector) —
// org-level, org_admin-managed taxonomy (same shape as servingRoles). No
// dependency on scheduling.ts/booking.ts, so this file can be imported by
// both without a cycle.
export const resources = pgTable("resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: resourceTypeEnum("type").notNull().default("room"),
  capacity: integer("capacity"),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
