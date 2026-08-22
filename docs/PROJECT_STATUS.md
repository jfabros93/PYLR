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
| 2 — Event Planner | ✅ Done | Resources, booking requests, the full approval state machine, and the exclusion-constraint conflict prevention. See `packages/db/src/schema/{resources,booking}.ts`, `packages/db/migrations/0006_booking_rls.sql`, `apps/api/src/modules/booking/`. **Start here next: Phase 3.** |
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
                               # apps/api/test/booking.test.ts — 17 tests
                               # scheduling.test.ts proves the whole Phase 1
                               # flow end-to-end (per-team authorization,
                               # idempotent occurrence generation, the full
                               # plan builder, self-service assignment
                               # confirmation, publishing, cross-tenant
                               # isolation). booking.test.ts proves Phase 2:
                               # the pending/approved/denied/changes_requested
                               # /cancelled state machine, and — the
                               # explicitly flagged risk — two concurrent
                               # approve() calls racing on overlapping
                               # bookings for the same resource (exactly one
                               # succeeds, the exclusion constraint rejects
                               # the other with a 409) plus a same-row
                               # double-approve race caught by an app-layer
                               # status guard before ever reaching Postgres.
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
- **Only `team_leader`s can submit a booking request**, not `team_member`s
  — a deliberate Phase 2 decision to mirror Service/Plan's existing
  create-restriction, not a technical limitation. Easy to loosen later:
  it's one `canWithConditions` call in `packages/auth/src/ability.ts`.
- **`resources.requires_approval` is currently informational only.** Every
  booking request lands as `pending` and goes through the normal approval
  queue regardless of this flag — no auto-approve path exists yet, again a
  deliberate Phase 2 decision (one approval path everywhere, no bypass
  even for a generated service occurrence's room reservation). See
  `BookingRequestsService.createBookingRequest`.
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

## Next up: Phase 3 — Public Events, Ticketing, Registration

Congregant-facing public events with free/paid ticketing — validates the
ticketing/inventory model and congregant PWA UX before real money (giving,
Phase 4) is involved. Core pieces per `docs/ARCHITECTURE.md`:
- `events` table — congregant-visible; `owning_team_id`,
  `source_booking_request_id` (when promoted from an approved Phase 2
  booking — the "promote an approved booking to a public event" workflow
  is the natural bridge between the two phases), `source_service_occurrence_id`
  (when promoting "this week's service" publicly, joining through to
  `plans → plan_speakers` rather than copying data), `visibility`,
  `status`, `requires_registration`, `is_paid`.
- `ticket_types`, `orders`, `tickets` — free RSVP reuses the same
  `orders`/`tickets` path as a paid ticket (a $0 ticket type), not a
  separate `registrations` table.
- Inventory safety: `quantity_sold` increment in the same transaction as
  ticket creation, backstopped by a `CHECK (quantity_sold <= quantity_available)`
  constraint — no Stripe/payment integration needed yet for the free-RSVP
  slice of this phase; that's Phase 4.
- `booking_requests.related_event_id` currently has no FK constraint
  (see the comment in `packages/db/src/schema/booking.ts`) — add
  `.references(() => events.id, { onDelete: "set null" })` once `events`
  exists, as part of this phase's first migration.
- `apps/congregant-web` is still a placeholder — this is the phase that
  makes it real.

## Where everything else lives

| Doc | What's in it |
|---|---|
| [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | Full data model, tech stack rationale, key workflows, phased roadmap. |
| [`docs/LOCAL_DEV.md`](./LOCAL_DEV.md) | How to set up and run the project locally, including wiring a real Clerk app. |
| [`AGENTS.md`](../AGENTS.md) / `CLAUDE.md` | Cross-tool agent guidance — commands, and the architectural patterns (RLS/tenant-isolation model, the coarse/precise ability-check pattern) you need before touching the API. |
