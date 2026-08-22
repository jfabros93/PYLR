import { z } from "zod";
import { MEMBER_STATUSES, ORG_ROLES } from "./enums.js";

export const userSchema = z.object({
  id: z.string().uuid(),
  authProviderId: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

// organizationId is deliberately NOT part of this schema — the org is
// always taken from the trusted :organizationId route param via
// TenantContextInterceptor, never from client-supplied body data.
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORG_ROLES).exclude(["congregant"]).default("team_member"),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const organizationMemberSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(ORG_ROLES),
  status: z.enum(MEMBER_STATUSES),
  invitedByUserId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

export const personSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  householdId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Person = z.infer<typeof personSchema>;
