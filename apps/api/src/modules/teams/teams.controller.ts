import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from "@nestjs/common";
import { addTeamMemberSchema, createTeamSchema } from "@pylr/schemas";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { TenantContextInterceptor } from "../../common/guards/tenant-context.interceptor";
import { CheckAbility } from "../../common/guards/check-ability.decorator";
import { Tenant, TenantDb } from "../../common/guards/tenant.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { TenantScopedRequest } from "../../common/guards/request.types";
import { TeamsService } from "./teams.service";

@Controller("organizations/:organizationId/teams")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @CheckAbility((ability) => ability.can("read", "Team"))
  async list(@TenantDb() tx: TenantScopedRequest["tenantDb"], @Tenant() tenant: TenantScopedRequest["tenant"]) {
    return this.teams.listTeams(tx, tenant.organizationId);
  }

  @Post()
  @CheckAbility((ability) => ability.can("create", "Team"))
  async create(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Body(new ZodValidationPipe(createTeamSchema.omit({ organizationId: true })))
    body: Omit<ReturnType<typeof createTeamSchema.parse>, "organizationId">,
  ) {
    return this.teams.createTeam(tx, tenant.organizationId, body);
  }

  @Post(":teamId/members")
  @CheckAbility((ability) => ability.can("create", "TeamMember"))
  async addMember(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("teamId") teamId: string,
    @Body(new ZodValidationPipe(addTeamMemberSchema.omit({ teamId: true })))
    body: Omit<ReturnType<typeof addTeamMemberSchema.parse>, "teamId">,
  ) {
    return this.teams.addTeamMember(tx, tenant, teamId, { teamId, ...body });
  }
}
