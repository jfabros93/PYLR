# Deployment

How PYLR is actually deployed live, per `docs/ARCHITECTURE.md`'s intended
split: `apps/api` (a long-running NestJS process + Postgres) on Railway,
`apps/staff-web`/`apps/congregant-web` on Vercel. Written after the first
real deploy — see `docs/PROJECT_STATUS.md` for whether one is currently live
and its URLs.

## Why not Vercel for the API

Vercel's model is serverless functions with a request-scoped lifetime.
`apps/api` is a single long-running NestJS process (WebSocket-shaped growth
room, DB connection pooling, background job workers planned per
`docs/ARCHITECTURE.md`'s tech stack table) — Railway or Fly.io fit that
shape; Vercel doesn't.

## 1. API + Postgres on Railway

`apps/api/Dockerfile` and `railway.json` (repo root) are already set up for
this — Railway builds `apps/api/Dockerfile` with the **repo root** as build
context (needed so the pnpm workspace can see `packages/{db,schemas,auth}`,
which `@pylr/api` depends on via `workspace:*`).

1. Create a Railway project, add a Postgres plugin to it.
2. Deploy `apps/api` as a service in that project, pointed at this GitHub
   repo (branch: whichever is live — see `docs/PROJECT_STATUS.md`),
   building via `railway.json`.
3. **Run migrations once, out-of-band**, using Postgres's superuser
   connection string (Railway gives you this on the Postgres plugin's
   "Connect" tab):
   ```sh
   DATABASE_URL="<railway-postgres-superuser-url>" pnpm --filter @pylr/db migrate
   ```
   This creates every table AND the `pylr_app`/`pylr_system` roles — with
   **no password set yet**, deliberately (see the comment at the top of
   `packages/db/migrations/0002_roles.sql`: passwords are never
   version-controlled).
4. **Set the two role passwords**, same pattern `scripts/dev-setup.sh` uses
   locally:
   ```sh
   APP_PW="$(openssl rand -hex 16)"
   SYSTEM_PW="$(openssl rand -hex 16)"
   psql "<railway-postgres-superuser-url>" -c "ALTER ROLE pylr_app WITH PASSWORD '$APP_PW';"
   psql "<railway-postgres-superuser-url>" -c "ALTER ROLE pylr_system WITH PASSWORD '$SYSTEM_PW';"
   ```
5. Set these environment variables on the Railway **API service** (not the
   Postgres plugin) — swap in the Postgres host/port/dbname Railway gives
   you and the passwords from step 4:
   | Var | Value |
   |---|---|
   | `DATABASE_URL_APP` | `postgres://pylr_app:$APP_PW@<host>:<port>/<db>` |
   | `DATABASE_URL_SYSTEM` | `postgres://pylr_system:$SYSTEM_PW@<host>:<port>/<db>` |
   | `CLERK_SECRET_KEY` | the Clerk app's secret key |
   | `PORT` | `3001` (or let Railway inject its own — `apps/api/src/config/env.ts` defaults to 3001) |

   `DATABASE_URL` and `CLERK_WEBHOOK_SECRET` stay unset on the running
   service — both are optional in `apps/api/src/config/env.ts`; the former
   is only for the one-off migrate step above (never the running app, which
   must never hold a schema-owning connection — see `AGENTS.md`), the
   latter matters once the Clerk webhook is actually wired (`docs/LOCAL_DEV.md`
   step 7 — still not done as of this writing).
6. Seed a demo org so there's something to click through immediately:
   ```sh
   DATABASE_URL_APP="..." DATABASE_URL_SYSTEM="..." pnpm --filter @pylr/db seed
   ```
7. Confirm `GET https://<railway-api-domain>/health` returns
   `{"status":"ok","service":"@pylr/api"}` before touching Vercel — this is
   the checkpoint that the API+DB half of the stack actually works.

## 2. staff-web and congregant-web on Vercel

Vercel auto-detects a Turborepo/pnpm-workspace monorepo once each
project's **Root Directory** is set — no `vercel.json` needed.

Create **two separate Vercel projects** from this GitHub repo:

| Project | Root Directory | Framework preset | Env vars |
|---|---|---|---|
| staff-web | `apps/staff-web` | Next.js (auto) | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `API_URL` (the Railway API's public URL from step 1) |
| congregant-web | `apps/congregant-web` | Next.js (auto) | `API_URL` |

After the first deploy, add the deployed **staff-web** domain to Clerk's
allowed origins/redirect URLs in the Clerk dashboard (Configure → Domains) —
this is a manual dashboard step, not something a deploy token can do, and a
first sign-in attempt fails silently without it.

## 3. First sign-in on the new deployment

The Clerk webhook still isn't wired (same gap as local dev — see
`docs/PROJECT_STATUS.md`'s "Known gaps"), so a brand-new sign-up on the
live deployment won't automatically get a `users` row. Either wire the
webhook for real (`docs/LOCAL_DEV.md` step 7 — now has a real public URL to
point it at, so this is easier to finish in prod than it was locally), or
repeat the one-off manual-sync script from `docs/LOCAL_DEV.md` step 6
against the Railway Postgres for each person who needs access.
