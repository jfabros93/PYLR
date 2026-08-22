import { z } from "zod";
import { TEAM_ROLES, TEAM_TYPES } from "./enums.js";

export const createTeamSchema = z.object({
  organizationId: z.string().uuid(),
  campusId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  type: z.enum(TEAM_TYPES).default("ministry"),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const teamSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  campusId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.enum(TEAM_TYPES),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Team = z.infer<typeof teamSchema>;

export const addTeamMemberSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(TEAM_ROLES).default("member"),
});
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;

export const teamMemberSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(TEAM_ROLES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;
