import { z } from "zod";
import { BOOKING_REQUEST_STATUSES, RESOURCE_TYPES } from "./enums.js";

// --- Resources ------------------------------------------------------------
// Org-level, org_admin-managed taxonomy (same shape as createServingRoleSchema
// in scheduling.ts) — a team_leader only reads these to pick one when
// submitting a booking.
export const createResourceSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(RESOURCE_TYPES).default("room"),
  capacity: z.number().int().positive().max(100_000).optional(),
  requiresApproval: z.boolean().default(true),
});
export type CreateResourceInput = z.infer<typeof createResourceSchema>;

export const updateResourceSchema = createResourceSchema.partial();
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

export const resourceSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  type: z.enum(RESOURCE_TYPES),
  capacity: z.number().nullable(),
  requiresApproval: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Resource = z.infer<typeof resourceSchema>;

// --- Booking requests -------------------------------------------------------
// requestingTeamId is a body field, not a route param — booking requests
// aren't nested under one team's URL (the approval queue/calendar are
// org-wide) — validated in the service layer against the caller's
// leaderOfTeamIds via canOne, the same way TeamMember validates teamId.
export const createBookingRequestSchema = z
  .object({
    requestingTeamId: z.string().uuid(),
    resourceId: z.string().uuid(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    purpose: z.string().max(2000).optional(),
    relatedServiceOccurrenceId: z.string().uuid().optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "endsAt must be after startsAt", path: ["endsAt"] });
export type CreateBookingRequestInput = z.infer<typeof createBookingRequestSchema>;

export const resubmitBookingRequestSchema = z
  .object({
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    purpose: z.string().max(2000).optional(),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });
export type ResubmitBookingRequestInput = z.infer<typeof resubmitBookingRequestSchema>;

// Shared by deny/request-changes — both just attach an optional note.
export const reviewNoteSchema = z.object({ reviewNote: z.string().max(2000).optional() });
export type ReviewNoteInput = z.infer<typeof reviewNoteSchema>;

export const bookingRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  requestingTeamId: z.string().uuid(),
  resourceId: z.string().uuid(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  purpose: z.string().nullable(),
  status: z.enum(BOOKING_REQUEST_STATUSES),
  relatedServiceOccurrenceId: z.string().uuid().nullable(),
  relatedEventId: z.string().uuid().nullable(),
  requestedByUserId: z.string().uuid(),
  reviewedByUserId: z.string().uuid().nullable(),
  reviewNote: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BookingRequest = z.infer<typeof bookingRequestSchema>;
