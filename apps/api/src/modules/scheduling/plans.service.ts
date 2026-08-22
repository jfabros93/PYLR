import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { canOne } from "@pylr/auth";
import { and, eq, inArray, schema } from "@pylr/db";
import type { Database } from "@pylr/db";
import type {
  AddAnnouncementInput,
  AddSongToPlanInput,
  AddSpeakerInput,
  AssignRoleInput,
  AssignSongPersonInput,
  UpdateAssignmentStatusInput,
  UpdatePlanInput,
} from "@pylr/schemas";
import type { TenantScopedRequest } from "../../common/guards/request.types";

@Injectable()
export class PlansService {
  // --- Plan itself -------------------------------------------------------

  /** Loads the occurrence's plan, auto-creating a draft one on first access — see docs/ARCHITECTURE.md's plan-builder workflow. */
  async getOrCreatePlanForOccurrence(tx: Database, tenant: TenantScopedRequest["tenant"], occurrenceId: string) {
    const occurrence = await tx.query.serviceOccurrences.findFirst({
      where: and(
        eq(schema.serviceOccurrences.id, occurrenceId),
        eq(schema.serviceOccurrences.organizationId, tenant.organizationId),
      ),
    });
    if (!occurrence) throw new NotFoundException("Occurrence not found");

    const existing = await tx.query.plans.findFirst({
      where: eq(schema.plans.serviceOccurrenceId, occurrence.id),
    });
    if (existing) return this.getPlanDetail(tx, tenant.organizationId, existing.id);

    if (!canOne(tenant.ability, "create", "Plan", { teamId: occurrence.teamId })) {
      throw new ForbiddenException("Not permitted to create a plan for this team's occurrence");
    }
    const [plan] = await tx
      .insert(schema.plans)
      .values({
        organizationId: tenant.organizationId,
        serviceOccurrenceId: occurrence.id,
        teamId: occurrence.teamId,
        createdByUserId: tenant.userId,
      })
      .returning();
    if (!plan) throw new Error("Plan insert returned no row");
    return this.getPlanDetail(tx, tenant.organizationId, plan.id);
  }

  async getPlan(tx: Database, organizationId: string, planId: string) {
    const plan = await tx.query.plans.findFirst({
      where: and(eq(schema.plans.id, planId), eq(schema.plans.organizationId, organizationId)),
    });
    if (!plan) throw new NotFoundException("Plan not found");
    return plan;
  }

  async getPlanDetail(tx: Database, organizationId: string, planId: string) {
    await this.getPlan(tx, organizationId, planId); // 404s if missing/wrong org
    return tx.query.plans.findFirst({
      where: eq(schema.plans.id, planId),
      with: {
        serviceOccurrence: { with: { service: true } },
        speakers: { with: { person: true }, orderBy: (s, { asc }) => [asc(s.order)] },
        songs: {
          with: { song: true, assignments: { with: { person: true } } },
          orderBy: (s, { asc }) => [asc(s.order)],
        },
        announcements: { with: { assignedPerson: true }, orderBy: (a, { asc }) => [asc(a.order)] },
        roleAssignments: { with: { servingRole: true, person: true } },
      },
    });
  }

  private async requirePlanUpdateAccess(tx: Database, tenant: TenantScopedRequest["tenant"], planId: string) {
    const plan = await this.getPlan(tx, tenant.organizationId, planId);
    if (!canOne(tenant.ability, "update", "Plan", { teamId: plan.teamId })) {
      throw new ForbiddenException("Not permitted to edit this plan");
    }
    return plan;
  }

  async updatePlan(tx: Database, tenant: TenantScopedRequest["tenant"], planId: string, input: UpdatePlanInput) {
    const plan = await this.requirePlanUpdateAccess(tx, tenant, planId);
    await tx
      .update(schema.plans)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schema.plans.id, plan.id));
    return this.getPlanDetail(tx, tenant.organizationId, plan.id);
  }

  async publishPlan(tx: Database, tenant: TenantScopedRequest["tenant"], planId: string) {
    const plan = await this.requirePlanUpdateAccess(tx, tenant, planId);
    await tx.update(schema.plans).set({ status: "published", updatedAt: new Date() }).where(eq(schema.plans.id, plan.id));
    return this.getPlanDetail(tx, tenant.organizationId, plan.id);
  }

  // --- Speakers ------------------------------------------------------------

  async addSpeaker(tx: Database, tenant: TenantScopedRequest["tenant"], planId: string, input: AddSpeakerInput) {
    const plan = await this.requirePlanUpdateAccess(tx, tenant, planId);
    const personId = await this.resolvePersonId(tx, tenant.organizationId, input);

    const [speaker] = await tx
      .insert(schema.planSpeakers)
      .values({
        organizationId: tenant.organizationId,
        planId: plan.id,
        personId,
        roleLabel: input.roleLabel,
        sermonTitle: input.sermonTitle,
        order: input.order,
      })
      .returning();
    return speaker;
  }

  async removeSpeaker(tx: Database, tenant: TenantScopedRequest["tenant"], planId: string, speakerId: string) {
    await this.requirePlanUpdateAccess(tx, tenant, planId);
    await tx
      .delete(schema.planSpeakers)
      .where(and(eq(schema.planSpeakers.id, speakerId), eq(schema.planSpeakers.planId, planId)));
  }

  // --- Songs -----------------------------------------------------------

  async addSongToPlan(tx: Database, tenant: TenantScopedRequest["tenant"], planId: string, input: AddSongToPlanInput) {
    const plan = await this.requirePlanUpdateAccess(tx, tenant, planId);
    const song = await tx.query.songs.findFirst({
      where: and(eq(schema.songs.id, input.songId), eq(schema.songs.organizationId, tenant.organizationId)),
    });
    if (!song) throw new NotFoundException("Song not found");

    const [planSong] = await tx
      .insert(schema.planSongs)
      .values({
        organizationId: tenant.organizationId,
        planId: plan.id,
        songId: song.id,
        order: input.order,
        key: input.key,
        notes: input.notes,
      })
      .returning();
    return planSong;
  }

  async removeSongFromPlan(tx: Database, tenant: TenantScopedRequest["tenant"], planId: string, planSongId: string) {
    await this.requirePlanUpdateAccess(tx, tenant, planId);
    await tx
      .delete(schema.planSongs)
      .where(and(eq(schema.planSongs.id, planSongId), eq(schema.planSongs.planId, planId)));
  }

  async assignSongPerson(
    tx: Database,
    tenant: TenantScopedRequest["tenant"],
    planId: string,
    planSongId: string,
    input: AssignSongPersonInput,
  ) {
    await this.requirePlanUpdateAccess(tx, tenant, planId);
    const planSong = await tx.query.planSongs.findFirst({
      where: and(eq(schema.planSongs.id, planSongId), eq(schema.planSongs.planId, planId)),
    });
    if (!planSong) throw new NotFoundException("Song is not on this plan");

    const [assignment] = await tx
      .insert(schema.planSongAssignments)
      .values({
        organizationId: tenant.organizationId,
        planSongId: planSong.id,
        personId: input.personId,
        instrumentOrRole: input.instrumentOrRole,
      })
      .onConflictDoNothing({
        target: [
          schema.planSongAssignments.planSongId,
          schema.planSongAssignments.personId,
          schema.planSongAssignments.instrumentOrRole,
        ],
      })
      .returning();
    return assignment;
  }

  async removeSongAssignment(
    tx: Database,
    tenant: TenantScopedRequest["tenant"],
    planId: string,
    assignmentId: string,
  ) {
    await this.requirePlanUpdateAccess(tx, tenant, planId);
    await tx.delete(schema.planSongAssignments).where(eq(schema.planSongAssignments.id, assignmentId));
  }

  // --- Announcements ---------------------------------------------------

  async addAnnouncement(
    tx: Database,
    tenant: TenantScopedRequest["tenant"],
    planId: string,
    input: AddAnnouncementInput,
  ) {
    const plan = await this.requirePlanUpdateAccess(tx, tenant, planId);
    const [announcement] = await tx
      .insert(schema.planAnnouncements)
      .values({ organizationId: tenant.organizationId, planId: plan.id, ...input })
      .returning();
    return announcement;
  }

  async removeAnnouncement(
    tx: Database,
    tenant: TenantScopedRequest["tenant"],
    planId: string,
    announcementId: string,
  ) {
    await this.requirePlanUpdateAccess(tx, tenant, planId);
    await tx
      .delete(schema.planAnnouncements)
      .where(and(eq(schema.planAnnouncements.id, announcementId), eq(schema.planAnnouncements.planId, planId)));
  }

  // --- Serving-role grid --------------------------------------------------

  async addRoleAssignment(tx: Database, tenant: TenantScopedRequest["tenant"], planId: string, input: AssignRoleInput) {
    const plan = await this.requirePlanUpdateAccess(tx, tenant, planId);
    const role = await tx.query.servingRoles.findFirst({
      where: and(
        eq(schema.servingRoles.id, input.servingRoleId),
        eq(schema.servingRoles.organizationId, tenant.organizationId),
      ),
    });
    if (!role) throw new NotFoundException("Serving role not found");

    const [assignment] = await tx
      .insert(schema.planRoleAssignments)
      .values({
        organizationId: tenant.organizationId,
        planId: plan.id,
        servingRoleId: role.id,
        personId: input.personId,
      })
      .onConflictDoNothing({
        target: [
          schema.planRoleAssignments.planId,
          schema.planRoleAssignments.servingRoleId,
          schema.planRoleAssignments.personId,
        ],
      })
      .returning();
    return assignment;
  }

  /**
   * Updates an assignment's status (confirmed/declined/invited). Either
   * the team leader (via plan-edit rights) or the assignee themself — a
   * `people` row linked to the caller's own account — may do this, which
   * is what makes the "my assignments" confirm/decline flow work without
   * a separate permission model.
   */
  async updateRoleAssignmentStatus(
    tx: Database,
    tenant: TenantScopedRequest["tenant"],
    planId: string,
    assignmentId: string,
    input: UpdateAssignmentStatusInput,
  ) {
    const plan = await this.getPlan(tx, tenant.organizationId, planId);
    const assignment = await tx.query.planRoleAssignments.findFirst({
      where: and(eq(schema.planRoleAssignments.id, assignmentId), eq(schema.planRoleAssignments.planId, planId)),
    });
    if (!assignment) throw new NotFoundException("Assignment not found");

    const canEditAsLeader = canOne(tenant.ability, "update", "Plan", { teamId: plan.teamId });
    const isSelf = assignment.personId
      ? await this.personBelongsToUser(tx, tenant.organizationId, assignment.personId, tenant.userId)
      : false;
    if (!canEditAsLeader && !isSelf) {
      throw new ForbiddenException("Not permitted to update this assignment");
    }

    const [updated] = await tx
      .update(schema.planRoleAssignments)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(schema.planRoleAssignments.id, assignmentId))
      .returning();
    return updated;
  }

  async removeRoleAssignment(tx: Database, tenant: TenantScopedRequest["tenant"], planId: string, assignmentId: string) {
    await this.requirePlanUpdateAccess(tx, tenant, planId);
    await tx
      .delete(schema.planRoleAssignments)
      .where(and(eq(schema.planRoleAssignments.id, assignmentId), eq(schema.planRoleAssignments.planId, planId)));
  }

  /** Serving-role assignments across all plans for the current user, for the "my assignments" view. */
  async listMyAssignments(tx: Database, tenant: TenantScopedRequest["tenant"]) {
    const myPeople = await tx.query.people.findMany({
      where: and(eq(schema.people.organizationId, tenant.organizationId), eq(schema.people.userId, tenant.userId)),
    });
    const myPersonIds = myPeople.map((p) => p.id);
    if (myPersonIds.length === 0) return [];

    return tx.query.planRoleAssignments.findMany({
      where: and(
        eq(schema.planRoleAssignments.organizationId, tenant.organizationId),
        inArray(schema.planRoleAssignments.personId, myPersonIds),
      ),
      with: {
        servingRole: true,
        plan: { with: { serviceOccurrence: { with: { service: true } } } },
      },
    });
  }

  // --- helpers -----------------------------------------------------------

  private async resolvePersonId(tx: Database, organizationId: string, input: AddSpeakerInput): Promise<string> {
    if (input.personId) {
      const person = await tx.query.people.findFirst({
        where: and(eq(schema.people.id, input.personId), eq(schema.people.organizationId, organizationId)),
      });
      if (!person) throw new NotFoundException("Person not found");
      return person.id;
    }
    // Guest speaker with no login — create a minimal `people` row, per
    // docs/ARCHITECTURE.md's "guest speaker with no login still works".
    const [guest] = await tx
      .insert(schema.people)
      .values({ organizationId, firstName: input.guestFirstName!, lastName: input.guestLastName })
      .returning();
    if (!guest) throw new Error("Guest person insert returned no row");
    return guest.id;
  }

  private async personBelongsToUser(
    tx: Database,
    organizationId: string,
    personId: string,
    userId: string,
  ): Promise<boolean> {
    const person = await tx.query.people.findFirst({
      where: and(
        eq(schema.people.id, personId),
        eq(schema.people.organizationId, organizationId),
        eq(schema.people.userId, userId),
      ),
    });
    return !!person;
  }
}
