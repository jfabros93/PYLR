// Shared enums — single source of truth for both the Postgres pgEnum
// definitions in @pylr/db and the Zod validation/DTOs used across the API
// and frontends. Keep these in sync with packages/db/src/schema/*.ts.

export const ORG_ROLES = [
  "org_admin",
  "team_leader",
  "team_member",
  "congregant",
] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const MEMBER_STATUSES = ["active", "invited", "suspended"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const TEAM_ROLES = ["leader", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_TYPES = [
  "ministry",
  "small_group",
  "staff_team",
  "informal",
] as const;
export type TeamType = (typeof TEAM_TYPES)[number];
