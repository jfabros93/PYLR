import { z } from "zod";

export const organizationSlug = z
  .string()
  .min(2)
  .max(63)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "slug must be lowercase alphanumeric with single hyphens between segments",
  );

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: organizationSlug,
  timezone: z.string().min(1).max(64).default("America/New_York"),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: organizationSlug,
  timezone: z.string(),
  defaultCurrency: z.string().length(3),
  logoUrl: z.string().url().nullable(),
  primaryColor: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Organization = z.infer<typeof organizationSchema>;

export const createCampusSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(120),
  address: z.string().max(500).optional(),
  timezoneOverride: z.string().max(64).optional(),
});
export type CreateCampusInput = z.infer<typeof createCampusSchema>;
