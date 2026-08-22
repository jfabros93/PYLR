import { pgEnum } from "drizzle-orm/pg-core";
import {
  MEMBER_STATUSES,
  ORG_ROLES,
  TEAM_ROLES,
  TEAM_TYPES,
} from "@pylr/schemas";

// Backed by the arrays in @pylr/schemas so the Postgres enum and the Zod
// enum used by the API/frontends can never drift apart.
export const orgRoleEnum = pgEnum("org_role", ORG_ROLES);
export const memberStatusEnum = pgEnum("member_status", MEMBER_STATUSES);
export const teamRoleEnum = pgEnum("team_role", TEAM_ROLES);
export const teamTypeEnum = pgEnum("team_type", TEAM_TYPES);
export const stripeConnectStatusEnum = pgEnum("stripe_connect_status", [
  "not_started",
  "onboarding",
  "active",
  "restricted",
]);
