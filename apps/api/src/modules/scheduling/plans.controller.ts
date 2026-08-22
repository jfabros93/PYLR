import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UseInterceptors } from "@nestjs/common";
import {
  addAnnouncementSchema,
  addSongToPlanSchema,
  addSpeakerSchema,
  assignRoleSchema,
  assignSongPersonSchema,
  updateAssignmentStatusSchema,
  updatePlanSchema,
} from "@pylr/schemas";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { TenantContextInterceptor } from "../../common/guards/tenant-context.interceptor";
import { CheckAbility } from "../../common/guards/check-ability.decorator";
import { Tenant, TenantDb } from "../../common/guards/tenant.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { TenantScopedRequest } from "../../common/guards/request.types";
import { PlansService } from "./plans.service";

@Controller("organizations/:organizationId/occurrences")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class OccurrencePlansController {
  constructor(private readonly plans: PlansService) {}

  @Get(":occurrenceId/plan")
  @CheckAbility((ability) => ability.can("read", "Plan"))
  async getOrCreate(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("occurrenceId") occurrenceId: string,
  ) {
    return this.plans.getOrCreatePlanForOccurrence(tx, tenant, occurrenceId);
  }
}

@Controller("organizations/:organizationId/plans")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  // Declared before ":planId" — Nest matches routes in declaration order,
  // and a static segment here would otherwise be swallowed as a :planId value.
  @Get("me/assignments")
  async myAssignments(@TenantDb() tx: TenantScopedRequest["tenantDb"], @Tenant() tenant: TenantScopedRequest["tenant"]) {
    return this.plans.listMyAssignments(tx, tenant);
  }

  @Get(":planId")
  @CheckAbility((ability) => ability.can("read", "Plan"))
  async get(@TenantDb() tx: TenantScopedRequest["tenantDb"], @Tenant() tenant: TenantScopedRequest["tenant"], @Param("planId") planId: string) {
    return this.plans.getPlanDetail(tx, tenant.organizationId, planId);
  }

  @Patch(":planId")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async update(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Body(new ZodValidationPipe(updatePlanSchema)) body: ReturnType<typeof updatePlanSchema.parse>,
  ) {
    return this.plans.updatePlan(tx, tenant, planId, body);
  }

  @Post(":planId/publish")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async publish(@TenantDb() tx: TenantScopedRequest["tenantDb"], @Tenant() tenant: TenantScopedRequest["tenant"], @Param("planId") planId: string) {
    return this.plans.publishPlan(tx, tenant, planId);
  }

  // --- Speakers ---
  @Post(":planId/speakers")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async addSpeaker(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Body(new ZodValidationPipe(addSpeakerSchema)) body: ReturnType<typeof addSpeakerSchema.parse>,
  ) {
    return this.plans.addSpeaker(tx, tenant, planId, body);
  }

  @Delete(":planId/speakers/:speakerId")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async removeSpeaker(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Param("speakerId") speakerId: string,
  ) {
    await this.plans.removeSpeaker(tx, tenant, planId, speakerId);
    return { deleted: true };
  }

  // --- Songs ---
  @Post(":planId/songs")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async addSong(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Body(new ZodValidationPipe(addSongToPlanSchema)) body: ReturnType<typeof addSongToPlanSchema.parse>,
  ) {
    return this.plans.addSongToPlan(tx, tenant, planId, body);
  }

  @Delete(":planId/songs/:planSongId")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async removeSong(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Param("planSongId") planSongId: string,
  ) {
    await this.plans.removeSongFromPlan(tx, tenant, planId, planSongId);
    return { deleted: true };
  }

  @Post(":planId/songs/:planSongId/assignments")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async assignSongPerson(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Param("planSongId") planSongId: string,
    @Body(new ZodValidationPipe(assignSongPersonSchema)) body: ReturnType<typeof assignSongPersonSchema.parse>,
  ) {
    return this.plans.assignSongPerson(tx, tenant, planId, planSongId, body);
  }

  @Delete(":planId/songs/:planSongId/assignments/:assignmentId")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async removeSongAssignment(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Param("assignmentId") assignmentId: string,
  ) {
    await this.plans.removeSongAssignment(tx, tenant, planId, assignmentId);
    return { deleted: true };
  }

  // --- Announcements ---
  @Post(":planId/announcements")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async addAnnouncement(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Body(new ZodValidationPipe(addAnnouncementSchema)) body: ReturnType<typeof addAnnouncementSchema.parse>,
  ) {
    return this.plans.addAnnouncement(tx, tenant, planId, body);
  }

  @Delete(":planId/announcements/:announcementId")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async removeAnnouncement(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Param("announcementId") announcementId: string,
  ) {
    await this.plans.removeAnnouncement(tx, tenant, planId, announcementId);
    return { deleted: true };
  }

  // --- Serving-role grid ---
  @Post(":planId/role-assignments")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async addRoleAssignment(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Body(new ZodValidationPipe(assignRoleSchema)) body: ReturnType<typeof assignRoleSchema.parse>,
  ) {
    return this.plans.addRoleAssignment(tx, tenant, planId, body);
  }

  @Patch(":planId/role-assignments/:assignmentId")
  async updateRoleAssignmentStatus(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Param("assignmentId") assignmentId: string,
    @Body(new ZodValidationPipe(updateAssignmentStatusSchema)) body: ReturnType<typeof updateAssignmentStatusSchema.parse>,
  ) {
    // No @CheckAbility here — PlansService.updateRoleAssignmentStatus
    // itself allows either a team-leader-with-edit-rights OR the
    // assignee confirming/declining their own invite, which a single
    // coarse ability check can't express.
    return this.plans.updateRoleAssignmentStatus(tx, tenant, planId, assignmentId, body);
  }

  @Delete(":planId/role-assignments/:assignmentId")
  @CheckAbility((ability) => ability.can("update", "Plan"))
  async removeRoleAssignment(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("planId") planId: string,
    @Param("assignmentId") assignmentId: string,
  ) {
    await this.plans.removeRoleAssignment(tx, tenant, planId, assignmentId);
    return { deleted: true };
  }
}
