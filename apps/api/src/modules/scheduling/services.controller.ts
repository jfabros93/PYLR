import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UseInterceptors } from "@nestjs/common";
import { createServiceSchema, generateOccurrencesSchema, updateServiceSchema } from "@pylr/schemas";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { TenantContextInterceptor } from "../../common/guards/tenant-context.interceptor";
import { CheckAbility } from "../../common/guards/check-ability.decorator";
import { Tenant, TenantDb } from "../../common/guards/tenant.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { TenantScopedRequest } from "../../common/guards/request.types";
import { ServicesService } from "./services.service";

@Controller("organizations/:organizationId/teams/:teamId/services")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @CheckAbility((ability) => ability.can("read", "Service"))
  async list(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("teamId") teamId: string,
  ) {
    return this.services.listServices(tx, tenant.organizationId, teamId);
  }

  @Post()
  @CheckAbility((ability) => ability.can("create", "Service"))
  async create(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("teamId") teamId: string,
    @Body(new ZodValidationPipe(createServiceSchema)) body: ReturnType<typeof createServiceSchema.parse>,
  ) {
    return this.services.createService(tx, tenant, teamId, body);
  }

  @Get(":serviceId")
  @CheckAbility((ability) => ability.can("read", "Service"))
  async get(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("teamId") teamId: string,
    @Param("serviceId") serviceId: string,
  ) {
    return this.services.getService(tx, tenant.organizationId, teamId, serviceId);
  }

  @Patch(":serviceId")
  @CheckAbility((ability) => ability.can("update", "Service"))
  async update(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("teamId") teamId: string,
    @Param("serviceId") serviceId: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) body: ReturnType<typeof updateServiceSchema.parse>,
  ) {
    return this.services.updateService(tx, tenant, teamId, serviceId, body);
  }

  @Delete(":serviceId")
  @CheckAbility((ability) => ability.can("delete", "Service"))
  async remove(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("teamId") teamId: string,
    @Param("serviceId") serviceId: string,
  ) {
    await this.services.deleteService(tx, tenant, teamId, serviceId);
    return { deleted: true };
  }

  @Get(":serviceId/occurrences")
  @CheckAbility((ability) => ability.can("read", "Service"))
  async listOccurrences(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("teamId") teamId: string,
    @Param("serviceId") serviceId: string,
  ) {
    return this.services.listOccurrences(tx, tenant.organizationId, teamId, serviceId);
  }

  @Post(":serviceId/occurrences/generate")
  @CheckAbility((ability) => ability.can("update", "Service"))
  async generateOccurrences(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("teamId") teamId: string,
    @Param("serviceId") serviceId: string,
    @Body(new ZodValidationPipe(generateOccurrencesSchema)) body: ReturnType<typeof generateOccurrencesSchema.parse>,
  ) {
    return this.services.generateOccurrences(tx, tenant, teamId, serviceId, body.count);
  }
}
