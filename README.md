# PYLR

A multi-tenant Church Management System (CHMS) — service/gathering scheduling, an internal event planner with resource-booking approvals, and a congregant-facing app for public events, ticketing, and giving.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — tech stack, system architecture, full data model, key workflows, and the phased implementation roadmap.
- [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md) — running the app locally, including wiring up a real Clerk application.

Phase 0 (monorepo scaffold, multi-tenant Postgres/RLS foundation, auth) is implemented under `apps/` and `packages/`.
