# PYLR — Church Management System: Architecture & Data Model

## Overview

PYLR is a multi-tenant Church Management System (CHMS) SaaS with three product surfaces:

1. **Service/gathering scheduling** for church teams (who's preaching, song set list + players, worship leader, announcements) — usable by main staff *and* by sub-groups (youth service, small bible studies).
2. **Event Planner** for internal resource booking — any ministry/small group can request the sanctuary or another church-owned space/resource, main staff approves, and the system must prevent overlapping approved bookings.
3. **Congregant-facing app** — public events (browse/register/buy tickets, promote Sunday speakers) and a **giving** feature (card donations), monetized not via a large monthly SaaS fee but by layering a platform fee on top of card-processing fees, with funds routed to each church's own bank account.

This document is the architecture and data model blueprint a future implementation phase builds from. It confirms: multi-tenant SaaS (many churches, isolated workspaces), and a congregant app that is web/PWA first with native mobile (iOS/Android) later, sharing one API.

## Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | Solo/small-team friendly, fast caching, plays well with Next.js |
| Language | TypeScript everywhere | One language across API + both frontends + future mobile; shared types package prevents contract drift |
| Backend/API | Node.js + NestJS, REST/OpenAPI (not GraphQL) | DI + guards/interceptors map cleanly onto tenant scoping and RBAC; REST keeps a future Expo mobile client trivial to support; GraphQL's added complexity isn't earned here |
| Database | PostgreSQL (Neon/Supabase/RDS) | Relational integrity is required for bookings/payments/ticket inventory; gives us exclusion constraints for airtight double-booking prevention and Row-Level Security for tenant isolation |
| ORM | Drizzle | This schema leans on Postgres-specific features (RLS, exclusion constraints, `jsonb`) that a heavier ORM like Prisma abstracts awkwardly; hand-written SQL migrations are needed either way |
| Auth | Clerk (fallback: Supabase Auth) | Near first-class multi-tenant "Organizations" concept maps to churches; same JWT works for web now and Expo later |
| Payments/Giving | Stripe Connect (Express accounts) + PaymentIntents/Subscriptions | Only realistic way to route funds to each church's own bank account while the platform automatically takes a cut (`application_fee_amount`); Express accounts keep KYC/compliance UI on Stripe, not us |
| File/media storage | Cloudflare R2 (or S3) + CDN | Flyers, song charts, logos; R2's zero egress fees matter as usage grows |
| Frontend | Next.js (App Router) — two apps: staff dashboard, congregant PWA | SSR for public event pages (SEO, fast load), PWA installability satisfies "web first" without committing to native yet |
| Shared UI | shadcn/ui + Tailwind, in `packages/ui` | Copy-in components, no lock-in, themeable per church later |
| Future native | Expo (React Native) | Consumes the same REST API + shared `packages/schemas`/`packages/api-client` as the PWA |
| Validation contracts | Zod in `packages/schemas` | Single source of truth for shapes across API + both frontends |
| Background jobs | BullMQ + Redis | Recurring donation charges, recurring service occurrence generation, reminders, receipts, idempotent Stripe webhook processing |
| Email | Resend or Postmark | Giving receipts, booking approval/denial notices, ticket confirmations |
| Hosting | Vercel (both Next.js apps) + Railway/Fly.io (NestJS API, Postgres, Redis) | API needs a long-running process for webhooks/workers — keep it off serverless |
| Observability | Sentry + Axiom/Better Stack | Cheap now, essential once real money moves through giving |

**Why not GraphQL / microservices / NoSQL:** this is a relational domain (bookings conflict-check each other, ledgers must reconcile, tickets have finite inventory). Postgres + a well-modularized NestJS monolith is the right complexity level for a solo/small team; split out services later only if something specific (e.g. the giving webhook processor) needs independent scaling.

## System Architecture

### Monorepo layout
```
pylr/
├── apps/
│   ├── api/              # NestJS backend — single source of truth
│   ├── staff-web/        # Next.js — scheduling, event planner, giving admin
│   ├── congregant-web/   # Next.js PWA — public/member-facing app
│   └── mobile/            # (Phase 5) Expo app, same API
├── packages/
│   ├── db/                # Drizzle schema, migrations, seed scripts
│   ├── schemas/           # Zod schemas/DTOs shared by api + frontends
│   ├── api-client/        # Typed fetch client
│   ├── ui/                 # shadcn-based shared components
│   ├── config/              # eslint/tsconfig/tailwind shared config
│   └── auth/                # Shared JWT verification, role helpers
```

### Tenancy isolation: shared schema + `organization_id` + Postgres RLS

Compared against DB-per-tenant and schema-per-tenant, shared-schema-with-RLS gives strong isolation (enforced at the database layer, not just app code) with low operational complexity and cheap connection pooling — the right tradeoff at an expected hundreds-to-low-thousands tenant count.

Mechanics:
- Every tenant-scoped table has a non-nullable `organization_id`.
- RLS enabled on every such table, policy compares `organization_id` to `current_setting('app.current_org_id')`.
- A NestJS guard/interceptor (`apps/api/src/common/guards/tenant-context.guard.ts`) sets `app.current_org_id`/`app.current_user_id` via `SET LOCAL` at the start of each request transaction, derived only from the verified JWT — never from client-supplied input.
- Application-layer guard is the second line of defense (repository calls require explicit `organizationId`); RLS is the backstop.
- Platform super-admin tooling uses a separate `BYPASSRLS` DB role, never a blanket bypass from the normal app connection.

### Auth & roles

Two-tiered role model:
- **Platform-level** (rare): `platform_admin` — internal PYLR staff only, audited "support mode" access, not silent data access.
- **Organization-level**, via `organization_members` (user × org × role): `org_admin` (full control), `team_leader` (scoped to their team(s) via `team_members.role='leader'`), `team_member` (own assignments only), `congregant` (public app only, self-registers per church).

A single user can belong to multiple churches with different roles in each. Permission checks resolve `{organizationId, orgRole, teamRoles[]}` from the JWT + DB lookup, evaluated with a small policy layer (CASL fits well: `can('approve', 'BookingRequest')`, `can('update', plan)`).

Congregants get a lighter signup path (email/magic link, or guest checkout with no forced account) — captured as a `people` record regardless of whether a login exists, mergeable with a `users` row later.

## Data Model

All tenant-scoped tables carry `organization_id`; all tables carry `id (uuid)`, `created_at`, `updated_at` unless noted.

### Tenancy
- **`organizations`** — the church/tenant root: `name`, `slug` (unique, public URLs), `timezone`, `stripe_connect_account_id`, `stripe_connect_status`, `platform_fee_bps`, branding fields.
- **`campuses`** — multi-campus support; every org gets at least one default campus row for model uniformity.

### Users, People, Teams
- **`users`** — global login identity (`auth_provider_id`, `email`, name); not tenant-scoped, since one login can belong to multiple orgs.
- **`organization_members`** — join table: `organization_id`, `user_id`, `role` enum (`org_admin|team_leader|team_member|congregant`), `status`.
- **`people`** — contact record, superset of `users`; exists even without login (`user_id` nullable). Ticket buyers/donors/guest speakers attach here; merges with a `users` row when they later log in.
- **`teams`** — ministries/sub-groups (Youth Ministry, Worship Team, Men's Group, informal groups), `type`, `campus_id`.
- **`team_members`** — `team_id` × `user_id` × `role` (`leader|member`).

### Service / Gathering Scheduling
Modeled as **Service** (recurring/one-off concept, owned by a team) → **ServiceOccurrence** (one dated instance) → **Plan** (the lineup for that instance):
- **`services`** — `team_id`, `name`, `recurrence_rule` (iCal RRULE), `default_time/duration`, `default_resource_id`, `is_public` (eligible to promote to congregant app).
- **`service_occurrences`** — `service_id`, `occurs_at`, `resource_id`, `status` — generated ahead by a recurrence job.
- **`plans`** — 1:1 with an occurrence, `status` (`draft|published`), `title`/sermon series, `notes`.
- **`plan_speakers`** — `plan_id`, `person_id`, `role_label`, `sermon_title`/topic, `order` — supports co-speakers/guests with no login.
- **`songs`** — org-level reusable library (`title`, `artist`, `default_key`, `ccli_number`, chart/lyrics URL).
- **`plan_songs`** — `plan_id`, `song_id`, `order`, `key`.
- **`plan_song_assignments`** — who's playing each song (`plan_song_id`, `person_id`, `instrument_or_role`).
- **`plan_announcements`** — `title`, `content`, `assigned_person_id`, `order`.
- **`serving_roles`** — org-level extensible role *types* (Sound Tech, Greeter, Worship Leader), optionally team-specific.
- **`plan_role_assignments`** — the generalized serving-roles grid: `plan_id`, `serving_role_id`, `person_id` (nullable = open slot), `status` (`invited|confirmed|declined`). Worship leader is just another row here, not a dedicated table.

### Event Planner: Resources & Booking
- **`resources`** — bookable spaces/equipment: `name`, `type`, `capacity`, `requires_approval`.
- **`booking_requests`** — `requesting_team_id`, `resource_id`, `starts_at`/`ends_at`, `status` state machine, `related_service_occurrence_id` (unifies service room bookings with event bookings under one conflict-check mechanism), `related_event_id`.

State machine: `pending → approved|denied`, `pending → changes_requested → pending` (resubmit), `approved → cancelled` (withdraw or staff revoke). Only `approved` rows block other approvals — `pending` requests don't silently reject each other; staff see contention and choose.

**Conflict prevention — Postgres exclusion constraint** (structurally prevents double-booking at the DB layer, race-condition-proof unlike an app-level check):
```sql
ALTER TABLE booking_requests
  ADD COLUMN during tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE booking_requests
  ADD CONSTRAINT no_overlapping_approved_bookings
  EXCLUDE USING gist (resource_id WITH =, during WITH &&)
  WHERE (status = 'approved');
```
An approval action that would violate this throws a constraint violation → API returns 409 with a clear message.

### Public Events, Ticketing, Registration
- **`events`** — congregant-visible; `owning_team_id`, `source_booking_request_id` (when promoted from an internal booking), `source_service_occurrence_id` (when promoting "this week's service" publicly — the tie-back to feature 1's speaker/topic), `visibility`, `status`, `requires_registration`, `is_paid`.
  - When `source_service_occurrence_id` is set, the public page **joins through** to `plans → plan_speakers` (published only) rather than copying data — one source of truth. Optional `public_speaker_override_text` for editorial control.
- **`ticket_types`** — `event_id`, `name`, `price_cents` (0 = free), `quantity_available`/`quantity_sold`, sales window.
- **`orders`** — `purchaser_person_id`, `status`, `subtotal/platform_fee/processor_fee/total_cents`, `stripe_payment_intent_id`.
- **`tickets`** — `order_id`, `ticket_type_id`, `attendee_person_id` (may differ from purchaser), `status`, `qr_code_token` for check-in.
- Free RSVP events reuse the same `orders`/`tickets` path (a $0 ticket type) rather than a separate `registrations` table — one code path for "reserve a spot," paid or free.
- Inventory safety: `quantity_sold` increment happens in the same transaction as ticket creation, backstopped by a `CHECK (quantity_sold <= quantity_available)` constraint.

### Giving
- **`funds`** — designations (General Fund, Missions, Building Fund).
- **`donations`** — one financial transaction (one-time or a recurring plan's individual charge): `donor_person_id`, `fund_id`, `amount_cents`, `platform_fee_cents`, `processor_fee_cents`, `net_amount_cents`, `payment_method` (`card` now, `ach` placeholder), `recurring_plan_id`, `status`, Stripe IDs, `donor_covered_fees`/`donor_requested_amount_cents` (to support an optional "cover processing fees" UI toggle from day one, even if it ships later).
- **`recurring_giving_plans`** — `donor_person_id`, `fund_id`, `amount_cents`, `frequency`, `stripe_subscription_id`, `status`, `next_charge_at`.
- **`giving_statements`** — materialized per donor per tax year (`total_amount_cents`, `pdf_url`), generated by a scheduled job rather than computed on every request — needed for IRS 501(c)(3) donor receipt requirements.

**Fee flow:** platform fee is passed to Stripe as `application_fee_amount` on a PaymentIntent with `transfer_data.destination` = the church's connected account; Stripe automatically routes the platform's cut to PYLR's own Stripe balance and the remainder to the church's account at their normal payout schedule. PYLR never custodies church funds. `processor_fee_cents` is reconciled from the charge's `balance_transaction`, which may only be available shortly after settlement (async reconciliation job).

### Entity relationships (summary)
```
Organization 1─* Campus
Organization 1─* OrganizationMember *─1 User
Organization 1─* People (1─0/1 User)
Organization 1─* Team *─* User (via TeamMember)

Team 1─* Service 1─* ServiceOccurrence 1─1 Plan
Plan 1─* PlanSpeaker(→People) / PlanSong(→Song)─*PlanSongAssignment(→People) / PlanAnnouncement / PlanRoleAssignment(→ServingRole,→People)

Team 1─* BookingRequest *─1 Resource
BookingRequest 0/1─0/1 ServiceOccurrence   BookingRequest 0/1─1 Event

Event 0/1─1 ServiceOccurrence (promoted service)
Event 1─* TicketType 1─* Ticket *─1 Order ─1 People

Organization 1─* Fund
People 1─* Donation *─1 Fund
People 1─0/1 RecurringGivingPlan 1─* Donation
```

## Key Workflows

1. **Building a service plan** — team leader opens the upcoming occurrence, creates/edits its `plans` row, adds speaker(s), builds the song set list from the `songs` library with per-song assignments, adds announcements, fills the serving-roles grid, assigned people get notified and can confirm/decline, leader publishes — which (if `services.is_public`) makes speaker/topic visible on the congregant app via the join.
2. **Booking a room** — leader submits a `booking_requests` row (soft overlap warning shown at submission, not blocked); org admin sees a unified pending-approvals queue + resource calendar; approving hits the exclusion constraint, which rejects with 409 if another approval raced it; admin can instead request changes, looping the requester back to resubmit; approved bookings can be "promoted" to a public `events` row.
3. **Buying a ticket** — congregant browses public events, picks a ticket type, `orders`+`tickets` created transactionally with inventory checked against `quantity_available` (short TTL hold before payment), Stripe PaymentIntent created with Connect destination + application fee, webhook flips order to `paid` and tickets to `valid`, QR-code confirmation emailed, staff scan to check in.
4. **Giving** — congregant picks a fund and amount (optionally "cover fees"), one-time goes through a PaymentIntent exactly like ticketing; recurring creates a Stripe Subscription tied to a `recurring_giving_plans` row, each successful invoice creates a new `donations` row; failures use Stripe's built-in dunning/retries then pause the plan; year-end job aggregates into `giving_statements`.

## Phased Roadmap

0. **Foundation** ✅ — monorepo, org/user/people/team tables, auth + RLS + CASL, org onboarding. *Risk: RLS correctness needs automated cross-tenant-leak tests before anything else is trusted — see `packages/db/test/rls.test.ts`.*
1. **Service/Gathering Scheduling** ✅ — full scheduling table set, plan builder UI, "my assignments" view, RRULE-based occurrence generation (`rrule` package), a minimal People module (added mid-phase — needed to pick assignees in the UI, wasn't scoped in Phase 0). Verified against real Postgres in `apps/api/test/scheduling.test.ts`. *Known simplification: occurrence generation treats `defaultTime` as UTC rather than resolving the org's IANA timezone — see the comment in `apps/api/src/modules/scheduling/recurrence.ts`; a fast-follow, not yet done.*
2. **Event Planner** — resources, booking requests, exclusion-constraint conflict prevention, unified staff calendar. *Risk: explicitly test concurrent-approval races.*
3. **Public Events + free ticketing/RSVP** — validate the ticketing/inventory model and congregant PWA UX before money is involved.
4. **Giving** — Stripe Connect Express onboarding, fee computation, webhook-driven donation/recurring flow, giving statements; extend ticketing to paid events on the same Connect infrastructure. *Risks: Stripe's policies on religious-org accounts (confirm before building), webhook idempotency, async fee reconciliation, recurring-payment dunning UX, ACH deferred to later.*
5. **Native mobile (Expo)** — only after the API has stabilized under both web apps; reuses `packages/schemas` and `packages/api-client` as-is.

## Critical Files (once implementation starts)
- `packages/db/schema/*.ts` — Drizzle schema for all tables above
- `packages/db/migrations/*.sql` — hand-tuned RLS policies and the `booking_requests` exclusion constraint (generated-migration tooling won't produce these correctly on its own)
- `apps/api/src/common/guards/tenant-context.guard.ts` — sets `app.current_org_id` via `SET LOCAL`; the entire tenant-isolation model hinges on this
- `apps/api/src/modules/giving/webhooks/stripe-webhook.controller.ts` — idempotent Stripe webhook handler, central to both giving and ticketing payment state
- `packages/schemas/src/*.ts` — Zod contracts shared across API and every client

## Validating This Blueprint
- Walk each of the four key workflows above against the data model and confirm no missing FK/state is needed to execute it end-to-end.
- Confirm the tenancy model (RLS + `organization_id`) is applied consistently — no tenant-scoped table listed above may be missing it.
- Once Phase 0 implementation begins, the concrete tests to write first are exactly the two flagged risks: (a) automated cross-tenant RLS leak tests (create two orgs, assert a user in org A can never read/write org B's rows even via a crafted request), and (b) a concurrency test that fires two simultaneous "approve" calls on overlapping bookings for the same resource and asserts the exclusion constraint rejects the second one.
- Before Phase 4 (Giving), confirm Stripe's current policy on religious-organization Connect accounts directly against Stripe's docs/support, since this is an external risk outside our control.
