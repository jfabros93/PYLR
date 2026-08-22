import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),

  // Owner-role connection string — DDL only (migrations). The API itself
  // must never hold this; it's read here only so a misconfiguration is
  // caught at boot instead of silently falling back to it.
  DATABASE_URL: z.string().url().optional(),

  // Non-owner, non-BYPASSRLS role — every tenant-scoped query in the API
  // goes through this connection, which is what makes the RLS policies in
  // packages/db/migrations/0001_rls.sql actually get enforced.
  DATABASE_URL_APP: z.string().url(),

  // BYPASSRLS role — used ONLY for the handful of legitimately
  // cross-tenant operations: Clerk webhook user sync, org creation intake,
  // platform admin tooling. Never wired into a request path that accepts
  // tenant-scoped input directly.
  DATABASE_URL_SYSTEM: z.string().url(),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration — see errors above.");
  }
  return parsed.data;
}
