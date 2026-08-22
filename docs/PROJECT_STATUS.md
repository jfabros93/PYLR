# Project Status — read this first

This is the "start here" doc for picking up PYLR — whether that's a fresh
AI coding session, a human contributor, or you six weeks from now. It's
a living document: **update it whenever you finish a phase or learn
something a future session would otherwise have to rediscover.**

## The goal, in one line

PYLR is a multi-tenant Church Management System: service/gathering
scheduling, an internal event planner with resource-booking approvals,
and a congregant-facing app for public events, ticketing, and giving.
Full detail: [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).

## Current state

| Phase | Status | Summary |
|---|---|---|
| 0 — Foundation | ✅ Done | Monorepo, multi-tenant Postgres+RLS model, Clerk auth, org/team CRUD. See `packages/db/migrations/000{0,1,2}_*.sql`, `apps/api/src/common/guards/tenant-context.interceptor.ts`. |
| 1 — Scheduling | ✅ Done | Services → occurrences → plans (speakers, set list, announcements, serving-roles grid). See `packages/db/src/schema/scheduling.ts`, `apps/api/src/modules/scheduling/`. |
| 2 — Event Planner | ⬜ Not started | Resources, booking requests, exclusion-constraint conflict prevention. **Start here next.** |
| 3 — Public events/ticketing | ⬜ Not started | |
| 4 — Giving | ⬜ Not started | |
| 5 — Native mobile | ⬜ Not started | |

Full roadmap with per-phase risk notes: [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md#phased-roadmap).

## What's actually verified, and how

Both phases were tested against a **real local Postgres instance**, not
mocked — this is the standard to hold future phases to as well; don't
write a new RLS policy or ability rule without a test proving it against
a live database the way these do.

```sh
pnpm --filter @pylr/db test   # packages/db/test/rls.test.ts — 9 tests
                               # Proves cross-tenant isolation is
                               # structurally impossible: reads, a crafted
                               # cross-org write, the users-table write
                               # lockdown, org-creation's RETURNING/RLS
                               # interaction.

pnpm --filter @pylr/api test  # apps/api/test/scheduling.test.ts — 11 tests
                               # Proves the whole scheduling flow end-to-end:
                               # per-team authorization, idempotent
                               # occurrence generation, the full plan
                               # builder, self-service assignment
                               # confirmation, publishing, cross-tenant
                               # isolation for the new tables.
```

Both suites need `DATABASE_URL_APP`/`DATABASE_URL_SYSTEM` set (see
[`docs/LOCAL_DEV.md`](./LOCAL_DEV.md) or run `bash scripts/dev-setup.sh`
once). The API's routes were also smoke-tested over real HTTP (server
booted, every route hit, confirmed 401s instead of 404s) to catch wiring
mistakes the direct service-layer tests can't.

## Known gaps / deliberate simplifications

Don't "fix" these without checking whether they're actually in scope for
what you're doing — they were conscious scope cuts, not oversights:

- **Occurrence generation treats time-of-day as UTC**, not the org's IANA
  timezone. See the comment in `apps/api/src/modules/scheduling/recurrence.ts`.
  A real fix needs a timezone library and decisions about DST — flagged
  as Phase 1 fast-follow work in `docs/ARCHITECTURE.md`, not done.
- **The Clerk webhook isn't wired for auto-sync.** New sign-ups don't
  automatically get a `users` row yet — see "Live local environment"
  below and `docs/LOCAL_DEV.md` step 7 for how to finish this when it's
  needed (needs ngrok or a real deployment with a public URL).
- **No resource/booking model yet.** `services`/`service_occurrences`
  have no room/resource reference — that's explicitly deferred to Phase 2
  (see the comment at the top of `packages/db/src/schema/scheduling.ts`).
- **People picking in the UI is a plain `<select>`**, not a search/autocomplete
  — fine at demo scale, will need real UX work once an org has more than
  a handful of people.
- **`packages/ui` is still an empty stub.** Nothing has been extracted
  into it yet; both Next.js apps use inline styles.

## This user's live local environment

Things a fresh session has no way to discover from the code alone —
useful context if you're picking this up as a new session but the user's
machine already has state from before:

- **Local path:** `/Users/jacobfabros/PYLR` (macOS, Cursor IDE).
- **Postgres:** Homebrew `postgresql@14` (the repo/CI target Postgres 16,
  but 14 works fine for everything built so far). `brew services` is
  broken on this machine's macOS version, so Postgres doesn't start
  automatically — if it's down, start it with:
  ```sh
  pg_ctl -D /opt/homebrew/var/postgresql@14 -l /opt/homebrew/var/postgresql@14/server.log start
  ```
- **Clerk:** a real (test-mode) Clerk application already exists and its
  keys are filled into this machine's gitignored `apps/api/.env` and
  `apps/staff-web/.env.local`. Don't ask the user to re-create one —
  ask them to paste the existing keys if a fresh checkout needs them
  again.
- **One user is already synced**: the account owner
  (`jacobfabros@gmail.com`) was manually inserted into the `users` table
  via the one-off script in `docs/LOCAL_DEV.md` step 6, since the real
  webhook isn't wired yet. Any *other* new sign-up on this machine will
  hit the same "no account found" 401 until either the webhook is set up
  or that same manual sync is repeated for them.
- **A demo org exists** ("Grace Community Church", seeded via
  `pnpm --filter @pylr/db seed`) alongside whatever real org the user
  created by clicking through onboarding.

## Next up: Phase 2 — Event Planner

Internal resource booking so ministries/small groups can request the
sanctuary or another church-owned space without double-booking it.
Core pieces per `docs/ARCHITECTURE.md`:
- `resources` table (bookable spaces/equipment).
- `booking_requests` with a state machine (`pending → approved/denied`,
  `changes_requested`, `cancelled`) and a **Postgres exclusion
  constraint** (`EXCLUDE USING gist`, needs `btree_gist`) on
  `(resource_id, tstzrange(starts_at, ends_at))` scoped to
  `status = 'approved'` — this is what makes double-booking structurally
  impossible at the database layer, the same design principle RLS
  applied to tenant isolation in Phase 0.
- Unify service-occurrence room bookings and ad-hoc event bookings
  through the same table (`related_service_occurrence_id`).
- The flagged risk to explicitly test: two simultaneous "approve" calls
  on overlapping bookings for the same resource — prove the exclusion
  constraint rejects the second one, the same way `rls.test.ts` proved
  cross-tenant isolation.

## Where everything else lives

| Doc | What's in it |
|---|---|
| [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | Full data model, tech stack rationale, key workflows, phased roadmap. |
| [`docs/LOCAL_DEV.md`](./LOCAL_DEV.md) | How to set up and run the project locally, including wiring a real Clerk app. |
| [`AGENTS.md`](../AGENTS.md) / `CLAUDE.md` | Cross-tool agent guidance — commands, and the architectural patterns (RLS/tenant-isolation model, the coarse/precise ability-check pattern) you need before touching the API. |
