import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy packages/db/.env.example to packages/db/.env and fill it in.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: { url },
  // Hand-written RLS/role migrations live alongside the generated ones in
  // ./migrations (see 0001_rls.sql, 0002_roles.sql) — added via
  // `pnpm generate:custom`, not by editing the generated table migration.
});
