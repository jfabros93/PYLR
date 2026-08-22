import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { canOne } from "@pylr/auth";
import { and, eq, schema } from "@pylr/db";
import type { Database } from "@pylr/db";
import type { AddTeamMemberInput, CreateTeamInput } from "@pylr/schemas";
import type { TenantScopedRequest } from "../../common/guards/request.types";

@Injectable()
export class TeamsService {
  async createTeam(tx: Database, organizationId: string, input: Omit<CreateTeamInput, "organizationId">) {
    const [team] = await tx
      .insert(schema.teams)
      .values({ organizationId, ...input })
      .returning();
    if (!team) throw new Error("Team insert returned no row");
    return team;
  }

  async listTeams(tx: Database, organizationId: string) {
    return tx.query.teams.findMany({
      where: eq(schema.teams.organizationId, organizationId),
    });
  }

  /**
   * Adds an existing org member to a team. The interceptor-level
   * `@CheckAbility` only confirms the caller has *some* "create
   * TeamMember" rule (org_admin, or a team_leader for at least one team);
   * this is the precise, per-record check — a team_leader may only add
   * people to teams they actually lead, which the coarse check above
   * can't express without knowing :teamId.
   */
  async addTeamMember(
    tx: Database,
    tenant: TenantScopedRequest["tenant"],
    teamId: string,
    input: AddTeamMemberInput,
  ) {
    const team = await tx.query.teams.findFirst({
      where: and(eq(schema.teams.id, teamId), eq(schema.teams.organizationId, tenant.organizationId)),
    });
    if (!team) throw new NotFoundException("Team not found");

    if (!canOne(tenant.ability, "create", "TeamMember", { teamId: team.id })) {
      throw new ForbiddenException("Not permitted to add members to this team");
    }

    const [member] = await tx
      .insert(schema.teamMembers)
      .values({ organizationId: tenant.organizationId, teamId: team.id, userId: input.userId, role: input.role })
      .onConflictDoNothing({ target: [schema.teamMembers.teamId, schema.teamMembers.userId] })
      .returning();
    if (!member) throw new ForbiddenException("That person is already on this team");
    return member;
  }
}
