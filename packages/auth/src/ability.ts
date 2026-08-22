import { AbilityBuilder, createMongoAbility, subject, type MongoAbility } from "@casl/ability";
import type { OrgRole } from "@pylr/schemas";

// Phase 1+ modules (scheduling, booking, giving, ...) extend this union as
// their subjects land — e.g. add a new subject here and a case in
// defineAbilityFor rather than inventing a parallel permission system.
export type Actions =
  | "manage"
  | "create"
  | "read"
  | "update"
  | "delete"
  | "invite"
  | "approve";

export type Subjects =
  | "Organization"
  | "Team"
  | "TeamMember"
  | "OrganizationMember"
  | "Person"
  | "Service"
  | "Plan"
  | "Song"
  | "ServingRole"
  | "Resource"
  | "BookingRequest"
  | "all";

export type AppAbility = MongoAbility<[Actions, Subjects]>;

/**
 * CASL's compile-time field validation for record-level conditions (e.g.
 * restricting `update Team` to `{ id: { $in: [...] } }`) requires every
 * subject to be modeled as a tagged interface, not the plain string union
 * used here — with plain strings it type-checks conditions against
 * `never`. Rather than add that modeling for two rules, this narrow,
 * explicitly-typed helper is the one place that bypasses it; the
 * (action, subject, conditions) triple is still fully typed to callers.
 */
function canWithConditions(
  can: AbilityBuilder<AppAbility>["can"],
  action: Actions | Actions[],
  subjectType: Subjects,
  conditions: Record<string, unknown>,
): void {
  (can as (a: unknown, s: unknown, c: unknown) => void)(action, subjectType, conditions);
}

/**
 * The check-time counterpart to canWithConditions — evaluates an ability
 * against one concrete record (e.g. "can I create a TeamMember on *this*
 * team") rather than the subject type in the abstract. Consumers should
 * use this instead of importing @casl/ability's own `subject()` helper
 * directly: besides the same plain-string-Subjects typing gap, a second,
 * separately-resolved @casl/ability install in a consumer's own
 * node_modules produces a `subject()` whose tagged return type
 * TypeScript treats as incompatible with this package's `AppAbility` —
 * routing it through here keeps everyone on one instance, the same
 * reasoning as @pylr/db re-exporting drizzle-orm's operators.
 */
export function canOne(
  ability: AppAbility,
  action: Actions,
  subjectType: Subjects,
  instance: Record<string, unknown>,
): boolean {
  return (ability.can as (a: unknown, s: unknown) => boolean)(action, subject(subjectType, instance));
}

export interface AbilitySubject {
  organizationId: string;
  role: OrgRole;
  /** Team ids where this user holds team_members.role = 'leader'. */
  leaderOfTeamIds: string[];
}

/**
 * Builds the CASL ability for one request, resolved from
 * { organizationId, orgRole, teamRoles[] } — see
 * apps/api/src/common/guards/tenant-context.guard.ts, which attaches this
 * to the request after loading the caller's organization_members row (and
 * team_members rows) for the org the request is scoped to.
 *
 * This is authorization only — it decides what a role is *allowed* to
 * touch. It does not replace RLS, which is what makes cross-tenant access
 * structurally impossible even if a check here is missed.
 */
export function defineAbilityFor(subject: AbilitySubject): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  switch (subject.role) {
    case "org_admin":
      can("manage", "all");
      break;

    case "team_leader":
      can("read", "Organization");
      can("read", "Team");
      canWithConditions(can, "update", "Team", { id: { $in: subject.leaderOfTeamIds } });
      // Adding an existing org member to their team — not the same as
      // inviting a brand-new person into the org, which stays org_admin-only.
      canWithConditions(can, ["create", "read", "update", "delete"], "TeamMember", {
        teamId: { $in: subject.leaderOfTeamIds },
      });
      // People aren't team-scoped (the same person can serve across
      // teams), so unlike Service/Plan this stays unconditioned.
      can(["create", "read"], "Person");

      // Scheduling (Phase 1): a team leader plans their own team's
      // services. Plan/Service are conditioned on the denormalized
      // teamId column (see packages/db/src/schema/scheduling.ts) the
      // same way TeamMember is above; PlanSpeaker/PlanSong/
      // PlanRoleAssignment etc. don't get their own subjects — they're
      // always edited through their parent Plan, so the service layer
      // re-checks "update this Plan" (via canOne) rather than modeling
      // a subject per sub-resource.
      can("read", "Service");
      canWithConditions(can, ["create", "update", "delete"], "Service", {
        teamId: { $in: subject.leaderOfTeamIds },
      });
      can("read", "Plan");
      canWithConditions(can, ["create", "update"], "Plan", { teamId: { $in: subject.leaderOfTeamIds } });
      // Songs are a shared org-level library, not team-scoped.
      can(["create", "read", "update"], "Song");
      // Defining new serving-role *types* ("Sound Tech", "Greeter") is
      // org-wide taxonomy, so it stays org_admin-only ("manage all");
      // team_leader only fills the grid in on their own plans.
      can("read", "ServingRole");

      // Event planner (Phase 2): resources are org-wide taxonomy like
      // ServingRole — org_admin defines them, team_leader only reads them
      // to pick one when submitting a booking. BookingRequest is
      // conditioned on requestingTeamId the same way Service/Plan are
      // conditioned on teamId; "approve" isn't granted here at all — only
      // org_admin's "manage all" can action a request, so a losing
      // team_leader can withdraw/resubmit their own (via "update") but
      // never approve it.
      can("read", "Resource");
      can("read", "BookingRequest");
      canWithConditions(can, ["create", "update"], "BookingRequest", {
        requestingTeamId: { $in: subject.leaderOfTeamIds },
      });
      break;

    case "team_member":
      can("read", "Organization");
      can("read", "Team");
      can("read", "TeamMember");
      can("read", "Person");
      can("read", "Service");
      can("read", "Plan");
      can("read", "Song");
      can("read", "ServingRole");
      can("read", "Resource");
      can("read", "BookingRequest");
      break;

    case "congregant":
      can("read", "Organization");
      break;
  }

  return build();
}
