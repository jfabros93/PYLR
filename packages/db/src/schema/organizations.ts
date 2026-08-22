import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { stripeConnectStatusEnum } from "./enums.js";

// The tenant root. Every tenant-scoped table elsewhere in the schema
// carries a non-nullable organization_id that (via RLS, see
// migrations/0001_rls.sql) can only ever match the org the current
// request is scoped to.
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("America/New_York"),
  defaultCurrency: text("default_currency").notNull().default("usd"),
  stripeConnectAccountId: text("stripe_connect_account_id"),
  stripeConnectStatus: stripeConnectStatusEnum("stripe_connect_status")
    .notNull()
    .default("not_started"),
  platformFeeBps: integer("platform_fee_bps").notNull().default(100),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Multi-campus support. Every org gets at least one default campus row
// (created alongside the org) so nothing downstream has to special-case
// a nullable campus reference.
export const campuses = pgTable("campuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  timezoneOverride: text("timezone_override"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
