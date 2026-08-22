# PYLR

A multi-tenant Church Management System (CHMS) — service/gathering scheduling, an internal event planner with resource-booking approvals, and a congregant-facing app for public events, ticketing, and giving.

- [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — **start here**: current phase, what's verified, known gaps, next steps.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — tech stack, system architecture, full data model, key workflows, and the phased implementation roadmap.
- [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md) — running the app locally, including wiring up a real Clerk application.

Phase 0 (monorepo scaffold, multi-tenant Postgres/RLS foundation, auth), Phase 1 (service/gathering scheduling), and Phase 2 (event planner — resource booking with exclusion-constraint conflict prevention) are implemented under `apps/` and `packages/`.
