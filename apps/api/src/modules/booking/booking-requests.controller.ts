import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from "@nestjs/common";
import { createBookingRequestSchema, resubmitBookingRequestSchema, reviewNoteSchema } from "@pylr/schemas";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { TenantContextInterceptor } from "../../common/guards/tenant-context.interceptor";
import { CheckAbility } from "../../common/guards/check-ability.decorator";
import { Tenant, TenantDb } from "../../common/guards/tenant.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { TenantScopedRequest } from "../../common/guards/request.types";
import { BookingRequestsService } from "./booking-requests.service";

@Controller("organizations/:organizationId/booking-requests")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class BookingRequestsController {
  constructor(private readonly bookingRequests: BookingRequestsService) {}

  // Declared before ":id" — same reasoning as PlansController's
  // "me/assignments" route.
  @Get("me")
  async me(@TenantDb() tx: TenantScopedRequest["tenantDb"], @Tenant() tenant: TenantScopedRequest["tenant"]) {
    return this.bookingRequests.listMyBookingRequests(tx, tenant);
  }

  @Get()
  @CheckAbility((ability) => ability.can("read", "BookingRequest"))
  async list(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Query("status") status?: string,
    @Query("teamId") teamId?: string,
    @Query("resourceId") resourceId?: string,
  ) {
    return this.bookingRequests.listBookingRequests(tx, tenant.organizationId, {
      status: status as never,
      teamId,
      resourceId,
    });
  }

  @Post()
  @CheckAbility((ability) => ability.can("create", "BookingRequest"))
  async create(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Body(new ZodValidationPipe(createBookingRequestSchema)) body: ReturnType<typeof createBookingRequestSchema.parse>,
  ) {
    return this.bookingRequests.createBookingRequest(tx, tenant, body);
  }

  @Get(":id")
  @CheckAbility((ability) => ability.can("read", "BookingRequest"))
  async get(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("id") id: string,
  ) {
    return this.bookingRequests.getBookingRequest(tx, tenant.organizationId, id);
  }

  @Post(":id/approve")
  @CheckAbility((ability) => ability.can("approve", "BookingRequest"))
  async approve(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("id") id: string,
  ) {
    return this.bookingRequests.approve(tx, tenant, id);
  }

  @Post(":id/deny")
  @CheckAbility((ability) => ability.can("approve", "BookingRequest")) // same coarse gate as approve
  async deny(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reviewNoteSchema)) body: ReturnType<typeof reviewNoteSchema.parse>,
  ) {
    return this.bookingRequests.deny(tx, tenant, id, body.reviewNote);
  }

  @Post(":id/request-changes")
  @CheckAbility((ability) => ability.can("approve", "BookingRequest"))
  async requestChanges(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reviewNoteSchema)) body: ReturnType<typeof reviewNoteSchema.parse>,
  ) {
    return this.bookingRequests.requestChanges(tx, tenant, id, body.reviewNote);
  }

  // No @CheckAbility — the service does an owner-or-admin self-service
  // check, the same shape as PlansController's updateRoleAssignmentStatus.
  @Post(":id/resubmit")
  async resubmit(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("id") id: string,
    @Body(new ZodValidationPipe(resubmitBookingRequestSchema)) body: ReturnType<typeof resubmitBookingRequestSchema.parse>,
  ) {
    return this.bookingRequests.resubmit(tx, tenant, id, body);
  }

  @Post(":id/cancel")
  async cancel(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("id") id: string,
  ) {
    return this.bookingRequests.cancel(tx, tenant, id);
  }
}
