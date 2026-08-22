import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy packages/db/.env.example to packages/db/.env and fill it in. " +
        "This must be a role that owns the schema (superuser/db-owner in local dev) — migrations run DDL " +
        "(including CREATE ROLE), which the app's own pylr_app role cannot do.",
    );
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log(`Running migrations against ${maskPassword(url)} ...`);
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
  console.log("Migrations complete.");

  await client.end();
}

function maskPassword(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return url;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
