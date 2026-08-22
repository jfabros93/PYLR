import { z } from "zod";
import { ROLE_ASSIGNMENT_STATUSES } from "./enums.js";

// --- Services ---------------------------------------------------------
// teamId/organizationId are always taken from the route (see teams.ts's
// inviteMemberSchema comment for why), never from the body.
export const createServiceSchema = z.object({
  name: z.string().min(1).max(120),
  recurrenceRule: z.string().max(200).optional(), // iCal RRULE, e.g. "FREQ=WEEKLY;BYDAY=SU"
  defaultTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM 24h time")
    .optional(),
  defaultDurationMinutes: z.number().int().positive().max(1440).default(90),
  isPublic: z.boolean().default(false),
  // The service's usual room/resource (Phase 2) — seeded onto each
  // generated occurrence's resourceId. See ServicesService.generateOccurrences.
  defaultResourceId: z.string().uuid().optional(),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const generateOccurrencesSchema = z.object({
  count: z.number().int().positive().max(52).default(8),
});
export type GenerateOccurrencesInput = z.infer<typeof generateOccurrencesSchema>;

// --- Plans --------------------------------------------------------------
export const updatePlanSchema = z.object({
  title: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

// --- Speakers -------------------------------------------------------------
// Either reference an existing person, or provide a guest's name inline —
// PlansService creates a minimal `people` row for the latter, per the
// "guest speaker with no login" case in docs/ARCHITECTURE.md.
export const addSpeakerSchema = z
  .object({
    personId: z.string().uuid().optional(),
    guestFirstName: z.string().min(1).max(120).optional(),
    guestLastName: z.string().max(120).optional(),
    roleLabel: z.string().min(1).max(120).default("Preaching"),
    sermonTitle: z.string().max(300).optional(),
    order: z.number().int().default(0),
  })
  .refine((v) => v.personId || v.guestFirstName, {
    message: "Provide either personId or guestFirstName",
  });
export type AddSpeakerInput = z.infer<typeof addSpeakerSchema>;

// --- Songs (org-level library) --------------------------------------------
export const createSongSchema = z.object({
  title: z.string().min(1).max(200),
  artist: z.string().max(200).optional(),
  defaultKey: z.string().max(10).optional(),
  ccliNumber: z.string().max(30).optional(),
  chartUrl: z.string().url().optional(),
  lyricsUrl: z.string().url().optional(),
});
export type CreateSongInput = z.infer<typeof createSongSchema>;

export const addSongToPlanSchema = z.object({
  songId: z.string().uuid(),
  order: z.number().int().default(0),
  key: z.string().max(10).optional(),
  notes: z.string().max(2000).optional(),
});
export type AddSongToPlanInput = z.infer<typeof addSongToPlanSchema>;

export const assignSongPersonSchema = z.object({
  personId: z.string().uuid(),
  instrumentOrRole: z.string().min(1).max(120),
});
export type AssignSongPersonInput = z.infer<typeof assignSongPersonSchema>;

// --- Announcements ---------------------------------------------------------
export const addAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(5000),
  assignedPersonId: z.string().uuid().optional(),
  order: z.number().int().default(0),
});
export type AddAnnouncementInput = z.infer<typeof addAnnouncementSchema>;

// --- Serving roles (org-level grid) -----------------------------------
export const createServingRoleSchema = z.object({
  name: z.string().min(1).max(120),
  teamId: z.string().uuid().optional(), // nullable = available org-wide
});
export type CreateServingRoleInput = z.infer<typeof createServingRoleSchema>;

export const assignRoleSchema = z.object({
  servingRoleId: z.string().uuid(),
  personId: z.string().uuid().optional(), // nullable = open slot needing a volunteer
});
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

export const updateAssignmentStatusSchema = z.object({
  status: z.enum(ROLE_ASSIGNMENT_STATUSES),
});
export type UpdateAssignmentStatusInput = z.infer<typeof updateAssignmentStatusSchema>;

// --- Output shapes (frontend typing — not runtime-validated on API
// responses, same convention as organizationSchema/teamSchema/etc.) -----
export const serviceSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  teamId: z.string().uuid(),
  name: z.string(),
  recurrenceRule: z.string().nullable(),
  defaultTime: z.string().nullable(),
  defaultDurationMinutes: z.number(),
  isPublic: z.boolean(),
  defaultResourceId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Service = z.infer<typeof serviceSchema>;

export const serviceOccurrenceSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  serviceId: z.string().uuid(),
  teamId: z.string().uuid(),
  occursAt: z.coerce.date(),
  durationMinutes: z.number(),
  status: z.enum(["scheduled", "cancelled"]),
  resourceId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ServiceOccurrence = z.infer<typeof serviceOccurrenceSchema>;

export const planSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  serviceOccurrenceId: z.string().uuid(),
  teamId: z.string().uuid(),
  title: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(["draft", "published"]),
  createdByUserId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Plan = z.infer<typeof planSchema>;

export const songSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  title: z.string(),
  artist: z.string().nullable(),
  defaultKey: z.string().nullable(),
  ccliNumber: z.string().nullable(),
  chartUrl: z.string().nullable(),
  lyricsUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Song = z.infer<typeof songSchema>;

export const servingRoleSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  teamId: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  icon: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ServingRole = z.infer<typeof servingRoleSchema>;

// The full plan-detail response (GET /plans/:planId) joins in speakers,
// songs (+ their assignments), announcements, and role assignments, each
// with their related person/song/servingRole record. That nested shape
// is read-only API output, not something the client constructs or
// validates, so it's described as a plain type here rather than a
// mirrored Zod schema.
export interface PlanDetail extends Plan {
  serviceOccurrence: ServiceOccurrence & { service: Service };
  speakers: {
    id: string;
    roleLabel: string;
    sermonTitle: string | null;
    order: number;
    person: { id: string; firstName: string; lastName: string | null };
  }[];
  songs: {
    id: string;
    order: number;
    key: string | null;
    notes: string | null;
    song: Song;
    assignments: {
      id: string;
      instrumentOrRole: string;
      person: { id: string; firstName: string; lastName: string | null };
    }[];
  }[];
  announcements: {
    id: string;
    title: string;
    content: string;
    order: number;
    assignedPerson: { id: string; firstName: string; lastName: string | null } | null;
  }[];
  roleAssignments: {
    id: string;
    status: "invited" | "confirmed" | "declined";
    servingRole: ServingRole;
    person: { id: string; firstName: string; lastName: string | null } | null;
  }[];
}
