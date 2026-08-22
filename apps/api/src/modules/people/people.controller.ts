import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from "@nestjs/common";
import { createPersonSchema } from "@pylr/schemas";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { TenantContextInterceptor } from "../../common/guards/tenant-context.interceptor";
import { CheckAbility } from "../../common/guards/check-ability.decorator";
import { Tenant, TenantDb } from "../../common/guards/tenant.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { TenantScopedRequest } from "../../common/guards/request.types";
import { PeopleService } from "./people.service";

@Controller("organizations/:organizationId/people")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  @CheckAbility((ability) => ability.can("read", "Person"))
  async list(@TenantDb() tx: TenantScopedRequest["tenantDb"], @Tenant() tenant: TenantScopedRequest["tenant"]) {
    return this.people.listPeople(tx, tenant.organizationId);
  }

  @Post()
  @CheckAbility((ability) => ability.can("create", "Person"))
  async create(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Body(new ZodValidationPipe(createPersonSchema)) body: ReturnType<typeof createPersonSchema.parse>,
  ) {
    return this.people.createPerson(tx, tenant.organizationId, body);
  }
}
