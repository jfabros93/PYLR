# Local Development Setup

This walks through running PYLR locally, including wiring up a real Clerk
application for auth. It assumes Node 22+, pnpm 10+, and PostgreSQL 16
installed locally (or reachable).

## 1. Install dependencies

```sh
pnpm install
```

## 2. Set up Postgres

Create the dev database and the two application roles the RLS model
depends on (see `docs/ARCHITECTURE.md` and `packages/db/migrations/` for
why these exist — `pylr_app` is a non-owner, non-BYPASSRLS role so RLS
actually applies to it; `pylr_system` is BYPASSRLS for the few
legitimately cross-tenant operations).

```sh
createdb pylr_dev
```

Copy the env example and point it at your Postgres superuser/owner
connection (used only for running migrations, never by the app):

```sh
cp packages/db/.env.example packages/db/.env
# edit packages/db/.env — DATABASE_URL should be a role that can run DDL
```

Run the migrations. This creates the schema, enables Row-Level Security,
and creates the `pylr_app`/`pylr_system` roles (see
`packages/db/migrations/0002_roles.sql`):

```sh
pnpm --filter @pylr/db migrate
```

The roles are created **without passwords** (that migration is
version-controlled, so it deliberately doesn't bake in secrets) — set
them now:

```sh
psql pylr_dev -c "ALTER ROLE pylr_app WITH PASSWORD 'pick-a-password';"
psql pylr_dev -c "ALTER ROLE pylr_system WITH PASSWORD 'pick-another-password';"
```

Update `packages/db/.env` with `DATABASE_URL_APP` / `DATABASE_URL_SYSTEM`
using those passwords, then optionally seed a demo church:

```sh
pnpm --filter @pylr/db seed
```

You can sanity-check the tenant-isolation model actually holds with:

```sh
pnpm --filter @pylr/db test
```

## 3. Set up a Clerk application

1. Create a free account at [clerk.com](https://clerk.com) if you don't
   have one, then create an application (any auth method — email is
   simplest to test with).
2. In the dashboard, go to **API Keys** and copy the **Publishable key**
   (`pk_test_...`) and **Secret key** (`sk_test_...`).

## 4. Wire up the API

```sh
cp apps/api/.env.example apps/api/.env
```

Fill in:
- `DATABASE_URL_APP` / `DATABASE_URL_SYSTEM` — same values as
  `packages/db/.env`.
- `CLERK_SECRET_KEY` — your real secret key.
- `CLERK_WEBHOOK_SECRET` — leave as the placeholder for now; see step 7.

```sh
pnpm --filter @pylr/api dev
```

Confirm it booted: `curl http://localhost:3001/health` should return
`{"status":"ok",...}`.

## 5. Wire up the staff dashboard

```sh
cp apps/staff-web/.env.example apps/staff-web/.env.local
```

Fill in `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` with
the same real values, then:

```sh
pnpm --filter @pylr/staff-web dev
```

Visit `http://localhost:3000` — you should be redirected into Clerk's
sign-in/sign-up UI. Sign up with a real (or Clerk-test-mode) email.

## 6. Sync your first user

Signing up creates you in **Clerk**, not yet in PYLR's own `users` table
— that sync normally happens via the Clerk webhook
(`apps/api/src/modules/auth/clerk-webhook.controller.ts`), which needs a
public URL for Clerk's servers to call. Until you've set that up (step
7), the fastest way to unblock local testing is to sync yourself in
manually, once, via Clerk's Backend API:

```sh
cd apps/api
CLERK_SECRET_KEY=sk_test_... \
DATABASE_URL_SYSTEM=postgres://pylr_system:...@localhost:5432/pylr_dev \
node --input-type=module -e '
import { createClerkClient } from "@clerk/backend";
import postgres from "postgres";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const sql = postgres(process.env.DATABASE_URL_SYSTEM);

const { data: users } = await clerk.users.getUserList({ limit: 1, orderBy: "-created_at" });
const me = users[0];
const email = me.emailAddresses[0].emailAddress;

await sql`
  insert into users (auth_provider_id, email, first_name, last_name)
  values (${me.id}, ${email}, ${me.firstName}, ${me.lastName})
  on conflict (auth_provider_id) do nothing
`;
console.log("Synced", email, "as", me.id);
await sql.end();
'
```

(This is exactly what the webhook handler does on `user.created` — see
that controller if you want the full logic instead of this inline
version.)

## 7. Set up the real webhook (recommended once the basics work)

For sign-ups to sync automatically going forward:

1. Expose your local API publicly, e.g. with `ngrok http 3001`.
2. In the Clerk dashboard, go to **Webhooks** → **Add Endpoint**, point
   it at `https://<your-ngrok-domain>/webhooks/clerk`, and subscribe to
   `user.created` and `user.updated`.
3. Copy the **Signing Secret** Clerk gives you into
   `apps/api/.env`'s `CLERK_WEBHOOK_SECRET`, restart the API.
4. Sign up a second test user through the browser — it should now
   appear in the `users` table without the manual step above.

## 8. Try the full flow

With a synced user, visit `http://localhost:3000` again — you should
land on the "Create your church's workspace" onboarding page. Create a
workspace, and you should land on its dashboard showing your membership.
