import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from "@nestjs/common";
import { createServingRoleSchema } from "@pylr/schemas";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { TenantContextInterceptor } from "../../common/guards/tenant-context.interceptor";
import { CheckAbility } from "../../common/guards/check-ability.decorator";
import { Tenant, TenantDb } from "../../common/guards/tenant.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { TenantScopedRequest } from "../../common/guards/request.types";
import { ServingRolesService } from "./serving-roles.service";

@Controller("organizations/:organizationId/serving-roles")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class ServingRolesController {
  constructor(private readonly servingRoles: ServingRolesService) {}

  @Get()
  @CheckAbility((ability) => ability.can("read", "ServingRole"))
  async list(@TenantDb() tx: TenantScopedRequest["tenantDb"], @Tenant() tenant: TenantScopedRequest["tenant"]) {
    return this.servingRoles.listServingRoles(tx, tenant.organizationId);
  }

  // Defining new role *types* (as opposed to filling them in on a plan)
  // is org_admin-only — see the ability comment in packages/auth/src/ability.ts.
  @Post()
  @CheckAbility((ability) => ability.can("create", "ServingRole"))
  async create(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Body(new ZodValidationPipe(createServingRoleSchema)) body: ReturnType<typeof createServingRoleSchema.parse>,
  ) {
    return this.servingRoles.createServingRole(tx, tenant.organizationId, body);
  }
}
