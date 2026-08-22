import { pgEnum } from "drizzle-orm/pg-core";
import {
  BOOKING_REQUEST_STATUSES,
  MEMBER_STATUSES,
  OCCURRENCE_STATUSES,
  ORG_ROLES,
  PLAN_STATUSES,
  RESOURCE_TYPES,
  ROLE_ASSIGNMENT_STATUSES,
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
export const occurrenceStatusEnum = pgEnum("occurrence_status", OCCURRENCE_STATUSES);
export const planStatusEnum = pgEnum("plan_status", PLAN_STATUSES);
export const roleAssignmentStatusEnum = pgEnum("role_assignment_status", ROLE_ASSIGNMENT_STATUSES);
export const resourceTypeEnum = pgEnum("resource_type", RESOURCE_TYPES);
export const bookingRequestStatusEnum = pgEnum("booking_request_status", BOOKING_REQUEST_STATUSES);
