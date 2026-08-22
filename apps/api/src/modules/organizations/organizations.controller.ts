import { Body, Controller, Get, Param, Post, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { createOrganizationSchema, inviteMemberSchema } from "@pylr/schemas";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { TenantContextInterceptor } from "../../common/guards/tenant-context.interceptor";
import { CheckAbility } from "../../common/guards/check-ability.decorator";
import { Tenant, TenantDb } from "../../common/guards/tenant.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedRequest, TenantScopedRequest } from "../../common/guards/request.types";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  @UseGuards(ClerkAuthGuard)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createOrganizationSchema)) body: ReturnType<typeof createOrganizationSchema.parse>,
  ) {
    return this.organizations.createOrganization(req.authProviderId, body);
  }

  @Get("me")
  @UseGuards(ClerkAuthGuard)
  async listMine(@Req() req: AuthenticatedRequest) {
    return this.organizations.listMyOrganizations(req.authProviderId);
  }

  @Get("by-slug/:slug")
  async bySlug(@Param("slug") slug: string) {
    return this.organizations.findPublicBySlug(slug);
  }

  @Get(":organizationId")
  @UseGuards(ClerkAuthGuard)
  @UseInterceptors(TenantContextInterceptor)
  async getCurrent(@TenantDb() tx: TenantScopedRequest["tenantDb"], @Tenant() tenant: TenantScopedRequest["tenant"]) {
    return this.organizations.getCurrentOrganization(tx, tenant.organizationId);
  }

  @Get(":organizationId/members")
  @UseGuards(ClerkAuthGuard)
  @UseInterceptors(TenantContextInterceptor)
  async listMembers(@TenantDb() tx: TenantScopedRequest["tenantDb"], @Tenant() tenant: TenantScopedRequest["tenant"]) {
    return this.organizations.listMembers(tx, tenant.organizationId);
  }

  @Post(":organizationId/members/invite")
  @UseGuards(ClerkAuthGuard)
  @UseInterceptors(TenantContextInterceptor)
  @CheckAbility((ability) => ability.can("invite", "OrganizationMember"))
  async invite(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: ReturnType<typeof inviteMemberSchema.parse>,
  ) {
    return this.organizations.inviteMember(tx, tenant.organizationId, tenant.userId, body);
  }
}
