import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from "@nestjs/common";
import { createResourceSchema, updateResourceSchema } from "@pylr/schemas";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { TenantContextInterceptor } from "../../common/guards/tenant-context.interceptor";
import { CheckAbility } from "../../common/guards/check-ability.decorator";
import { Tenant, TenantDb } from "../../common/guards/tenant.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { TenantScopedRequest } from "../../common/guards/request.types";
import { ResourcesService } from "./resources.service";

@Controller("organizations/:organizationId/resources")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  @CheckAbility((ability) => ability.can("read", "Resource"))
  async list(@TenantDb() tx: TenantScopedRequest["tenantDb"], @Tenant() tenant: TenantScopedRequest["tenant"]) {
    return this.resources.listResources(tx, tenant.organizationId);
  }

  @Post()
  @CheckAbility((ability) => ability.can("create", "Resource"))
  async create(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Body(new ZodValidationPipe(createResourceSchema)) body: ReturnType<typeof createResourceSchema.parse>,
  ) {
    return this.resources.createResource(tx, tenant.organizationId, body);
  }

  @Get(":resourceId")
  @CheckAbility((ability) => ability.can("read", "Resource"))
  async get(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("resourceId") resourceId: string,
  ) {
    return this.resources.getResource(tx, tenant.organizationId, resourceId);
  }

  @Patch(":resourceId")
  @CheckAbility((ability) => ability.can("update", "Resource"))
  async update(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("resourceId") resourceId: string,
    @Body(new ZodValidationPipe(updateResourceSchema)) body: ReturnType<typeof updateResourceSchema.parse>,
  ) {
    return this.resources.updateResource(tx, tenant.organizationId, resourceId, body);
  }

  @Delete(":resourceId")
  @CheckAbility((ability) => ability.can("delete", "Resource"))
  async remove(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("resourceId") resourceId: string,
  ) {
    await this.resources.deleteResource(tx, tenant.organizationId, resourceId);
    return { deleted: true };
  }

  @Get(":resourceId/calendar")
  @CheckAbility((ability) => ability.can("read", "Resource"))
  async calendar(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("resourceId") resourceId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.resources.getResourceCalendar(tx, tenant.organizationId, resourceId, new Date(from), new Date(to));
  }
}
