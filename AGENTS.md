# AGENTS.md

Guidance for AI coding agents (Cursor, Codex, Claude Code, etc.) working in this repository.

**Read [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) before doing anything else.** It has the current phase, what's verified vs. just written, known gaps, and this user's live local-environment state (paths, Postgres setup, Clerk keys already in place) — things you can't discover from the code alone. See also `docs/ARCHITECTURE.md` (full data model, roadmap) and `docs/LOCAL_DEV.md` (environment/Clerk setup).

## What this is

PYLR is a multi-tenant Church Management System (CHMS): service/gathering scheduling, an internal event planner with resource-booking approvals, and a congregant-facing app for public events, ticketing, and giving. Phase 0 (multi-tenant foundation: auth, orgs, teams) and Phase 1 (service/gathering scheduling) are implemented so far.

## Commands

Turborepo + pnpm workspace. Run from the repo root unless noted.

```sh
pnpm install                          # install everything
pnpm dev                              # all apps in dev mode
pnpm build / pnpm lint / pnpm typecheck / pnpm test   # across the whole workspace

pnpm --filter @pylr/api dev           # one app/package at a time
pnpm --filter @pylr/db test           # the RLS test suite (see below)
pnpm --filter @pylr/db exec vitest run test/rls.test.ts -t "a crafted INSERT"  # a single test

pnpm --filter @pylr/db generate       # drizzle-kit: regenerate the table migration from schema/*.ts
pnpm --filter @pylr/db generate:custom --name=whatever  # a new hand-written SQL migration slot
pnpm --filter @pylr/db migrate        # apply migrations (needs DATABASE_URL — see docs/LOCAL_DEV.md)
pnpm --filter @pylr/db seed           # seed a demo church locally
```

`packages/schemas`, `packages/db`, and `packages/auth` ship **compiled `dist/`** output (not raw source) — their `package.json` `main`/`types` point at `dist/`, and each has its own `build` script. This is deliberate: raw TypeScript source with `"type": "module"` breaks resolution differently across NestJS's tsc, Next.js's Turbopack, and vitest/tsx, so `turbo`'s `^build` dependency (in `turbo.json`) builds these before anything that consumes them. **After pulling changes to any of those three packages, run `pnpm build` (or at least `pnpm --filter <pkg> build`) before typechecking or running apps that depend on them** — stale `dist/` output is a common source of confusing errors. `packages/ui` is the one exception: it's consumed only by the two Next.js apps (same bundler), so it's kept as raw source with no build step.

## Architecture

### Monorepo layout
`apps/api` (NestJS) is the single backend. `apps/staff-web` (Next.js) is the internal staff dashboard. `apps/congregant-web` (Next.js) is the public-facing app. Shared logic lives in `packages/{db,schemas,auth,ui,config}` — see each package's own comments for specifics; `@pylr/schemas` (Zod) is the source of truth both `@pylr/db` (Drizzle pgEnum) and the API/frontends validate against, so a role/enum change starts there.

### Multi-tenancy is enforced by Postgres, not application code
Every tenant-scoped table carries `organization_id`, and Row-Level Security (`packages/db/migrations/0001_rls.sql`) is what actually keeps one church's data from another's — not a `WHERE organization_id = ...` an engineer might forget. This only works because the API connects as `pylr_app`, a role that is neither the table owner nor `BYPASSRLS` (`packages/db/migrations/0002_roles.sql`). A second role, `pylr_system` (`BYPASSRLS`), exists only for the handful of legitimately cross-tenant operations — org creation, Clerk user sync, public org-by-slug lookups — and must never be wired into a request path that takes tenant-scoped input.

Tenant-scoped queries must go through `withTenantContext`/`withUserContext` (`packages/db/src/client.ts`), which set `app.current_org_id`/`app.current_user_id` via `set_config(..., true)` inside a transaction — the exact session settings the RLS policies check. Note the `nullif(current_setting(...), '')` guard throughout `0001_rls.sql`: a pooled connection's custom GUC reverts to `''`, not `NULL`, after a transaction ends, which silently breaks naive RLS predicates if you write a new one without it.

In the API, `TenantContextInterceptor` (`apps/api/src/common/guards/tenant-context.interceptor.ts`) is the piece that ties this together per-request: it resolves the caller's org membership, builds a CASL ability (`packages/auth/src/ability.ts`), and wraps the *entire* rest of the request in one `withTenantContext` transaction, exposing it as `request.tenantDb`/`request.tenant` via the `@TenantDb()`/`@Tenant()` param decorators. Controllers/services must use that injected `tenantDb`, never the raw `APP_DB`/`SYSTEM_DB` tokens directly, or they bypass the tenant scoping entirely. `@CheckAbility(...)` route metadata is evaluated *inside* this same interceptor (not a separate guard) because Nest runs guards before interceptors, and the ability isn't known until the interceptor resolves membership.

### Auth
Clerk verifies sessions (`ClerkAuthGuard` → `packages/auth/src/clerk.ts`), but authorization (which org, which role) always comes from our own `organization_members` table, never trusted from the client. `users` has no INSERT/UPDATE policy for `pylr_app` at all — the Clerk webhook (`apps/api/src/modules/auth/clerk-webhook.controller.ts`) is the only writer, via `pylr_system`.

### Verifying tenant isolation
`packages/db/test/rls.test.ts` runs against a real local Postgres (not mocked) and is the load-bearing proof that cross-tenant access is structurally impossible — including a case that intentionally tries to smuggle a write into another org's rows. Treat this suite as required reading before touching `0001_rls.sql`, and extend it when adding RLS policies for new tables.

### Scheduling (Phase 1) and the coarse/precise ability-check pattern
`services` → `service_occurrences` → `plans` (with `plan_speakers`/`plan_songs`/`plan_song_assignments`/`plan_announcements`/`plan_role_assignments` hanging off a plan) is the whole scheduling model — see `packages/db/src/schema/scheduling.ts`. `service_occurrences` and `plans` both denormalize `teamId` from their owning `service` (the same reasoning as `team_members.organizationId` in Phase 0: lets RLS-adjacent checks key off a plain column instead of a join).

Every mutating scheduling endpoint follows the same two-layer ability check established by `TeamsService.addTeamMember` in Phase 0: `@CheckAbility(...)` on the route only confirms the caller has *some* rule for that action+subject (CASL ignores conditions when checking a bare subject type, so this passes for any `team_leader`, not just one leading the right team) — the *precise* per-record check happens in the service method via `canOne(tenant.ability, action, subjectType, { teamId })` (see `packages/auth/src/ability.ts`'s `canOne`/`canWithConditions`). Don't skip the service-layer check because the route already has a `@CheckAbility` — that's necessary but never sufficient for a team-scoped action.

`PlanRoleAssignment`/`PlanSongAssignment`/etc. don't get their own CASL subjects — they're always authorized through their parent `Plan` (fetch the plan, check `canOne(..., "update", "Plan", { teamId: plan.teamId })`). The one exception is confirming/declining your own assignment (`PlansService.updateRoleAssignmentStatus`), which also accepts the assignee themself (a `people` row linked to the caller's own `userId`) — see that method for the self-service branch.

Occurrence generation (`apps/api/src/modules/scheduling/recurrence.ts`) uses the `rrule` package against a service's iCal `recurrenceRule` string; it's a documented simplification that treats `defaultTime` as UTC rather than the org's IANA timezone, and only simple weekly/biweekly patterns are exercised by `apps/api/test/scheduling.test.ts`.

### Event Planner (Phase 2): exclusion constraints for structural conflict prevention

`resources` (bookable spaces/equipment) → `booking_requests` (`packages/db/src/schema/{resources,booking}.ts`) is Phase 2's model. Like RLS for tenant isolation, double-booking prevention is enforced by Postgres itself, not application code: `packages/db/migrations/0006_booking_rls.sql` adds a generated `during tstzrange` column and a GiST `EXCLUDE` constraint (`no_overlapping_approved_bookings`, needs `btree_gist`) scoped to `status = 'approved'` — Drizzle can't express either, so they're hand-written SQL rather than modeled in `booking.ts`, which carries a comment pointing there. Only `approved` rows participate; `pending` requests never reject each other, which is why two overlapping submissions can both exist as `pending` at once (see `apps/api/test/booking.test.ts`).

`BookingRequestsService`'s state-machine transitions (`apps/api/src/modules/booking/booking-requests.service.ts`) all go through one `transitionStatus` helper, hardened two ways against the concurrent-approval race the architecture doc flags explicitly: an app-layer `UPDATE ... WHERE id = $1 AND status = $2 RETURNING *` guard catches a same-row race cheaply (zero rows back → a clean "already actioned" `ConflictException`, no DB error involved), and the exclusion constraint itself is the backstop that catches two *different* rows racing to approve overlapping bookings for the same resource — something the app-layer guard can't see, since both rows are legitimately `pending` going in. Reuse this two-layer pattern for any future state machine that needs both authorization-shaped and constraint-shaped concurrency protection, rather than relying on just one.

One driver-shape gotcha worth knowing before writing a similar catch: drizzle-orm's postgres-js driver wraps every query failure in its own `DrizzleQueryError`, whose `.message` is a generic "Failed query: ..." string — the real Postgres error (with the SQLSTATE `.code` you actually want to switch on, e.g. `23P01` for `exclusion_violation`, `23503` for `foreign_key_violation`) is on `.cause`, not the thrown error itself. `pgErrorCode()` in `apps/api/src/modules/booking/booking-request.util.ts` checks both so it keeps working if that wrapping ever changes — use it (or its pattern) rather than reading `.code` off the caught error directly.

`services.defaultResourceId`/`serviceOccurrences.resourceId` (added this phase, deferred from Phase 1) let a recurring service claim a room; `ServicesService.generateOccurrences` reserves it through the exact same `insertPendingBookingRequest` helper an ad-hoc submission uses — a deliberate choice to keep one approval path everywhere, with no bypass for a team_leader who already has edit rights on the service.
