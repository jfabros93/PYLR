export * from "./client.js";
export * as schema from "./schema/index.js";
export * from "./schema/index.js";

// Re-exported so consumers (apps/api) never import drizzle-orm directly.
// Two copies of drizzle-orm in the dependency graph (one resolved for
// @pylr/db, a separate one resolved for a consumer that also depends on
// it directly) produce structurally-identical but nominally distinct
// classes — TS then rejects passing an @pylr/db query result's columns to
// a consumer's own `eq`/`and` calls. Routing everything through this one
// instance avoids that entirely.
export { and, eq, or, sql } from "drizzle-orm";
