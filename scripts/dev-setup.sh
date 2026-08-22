#!/usr/bin/env bash
# One-shot local dev setup for PYLR: creates the local Postgres database and
# app roles, runs migrations, and scaffolds the .env files each app/package
# needs (see docs/LOCAL_DEV.md for the full manual walkthrough this
# automates). Safe to re-run — every step is idempotent.
#
# Override any of these if your local Postgres setup differs from the
# defaults (a superuser named `postgres`, listening on localhost:5432):
#   PYLR_PG_SUPERUSER, PYLR_PG_HOST, PYLR_PG_PORT, PYLR_PG_DB
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PG_HOST="${PYLR_PG_HOST:-localhost}"
PG_PORT="${PYLR_PG_PORT:-5432}"
PG_DB="${PYLR_PG_DB:-pylr_dev}"

info()  { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn()  { printf '\033[1;33m!!\033[0m %s\n' "$1"; }
die()   { printf '\033[1;31mx\033[0m %s\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
command -v node >/dev/null || die "Node.js not found. Install Node 20+ first: https://nodejs.org"
command -v pnpm >/dev/null || die "pnpm not found. Install it: https://pnpm.io/installation"
command -v psql >/dev/null || die "PostgreSQL client tools not found. Install Postgres 16: https://www.postgresql.org/download/"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node $NODE_MAJOR found, but 20+ is required."

# ---------------------------------------------------------------------------
# 2. Find a Postgres role that can run DDL (create the db, create roles).
#    Tries the conventional `postgres` superuser, then falls back to the
#    current OS user (the common case for a Homebrew/macOS install, which
#    doesn't create a separate `postgres` role by default).
# ---------------------------------------------------------------------------
info "Looking for a Postgres role that can administer the local server..."
PG_SUPERUSER=""
for candidate in "${PYLR_PG_SUPERUSER:-}" postgres "$(id -un)"; do
  [ -z "$candidate" ] && continue
  if psql -w -h "$PG_HOST" -p "$PG_PORT" -U "$candidate" -d postgres -tAc "select 1" >/dev/null 2>&1; then
    PG_SUPERUSER="$candidate"
    break
  fi
done
[ -n "$PG_SUPERUSER" ] || die "Couldn't connect to Postgres as 'postgres' or '$(id -un)' on ${PG_HOST}:${PG_PORT}.
   Make sure Postgres is running, then re-run with PYLR_PG_SUPERUSER=<role> set to a role
   that can connect without a password prompt (e.g. PYLR_PG_SUPERUSER=myuser $0)."
info "Using Postgres role '$PG_SUPERUSER' for setup."

PSQL_ADMIN=(psql -w -h "$PG_HOST" -p "$PG_PORT" -U "$PG_SUPERUSER")

# ---------------------------------------------------------------------------
# 3. Create the dev database
# ---------------------------------------------------------------------------
if "${PSQL_ADMIN[@]}" -d postgres -tAc "select 1 from pg_database where datname = '${PG_DB}'" | grep -q 1; then
  info "Database '${PG_DB}' already exists."
else
  info "Creating database '${PG_DB}'..."
  "${PSQL_ADMIN[@]}" -d postgres -c "create database ${PG_DB}"
fi

# ---------------------------------------------------------------------------
# 4. Scaffold packages/db/.env (generates pylr_app/pylr_system passwords the
#    first time; reuses them on re-runs so this stays idempotent).
# ---------------------------------------------------------------------------
DB_ENV="packages/db/.env"
if [ ! -f "$DB_ENV" ]; then
  info "Writing $DB_ENV..."
  APP_PW="$(openssl rand -hex 16)"
  SYSTEM_PW="$(openssl rand -hex 16)"
  cat > "$DB_ENV" <<EOF
DATABASE_URL=postgres://${PG_SUPERUSER}@${PG_HOST}:${PG_PORT}/${PG_DB}
DATABASE_URL_APP=postgres://pylr_app:${APP_PW}@${PG_HOST}:${PG_PORT}/${PG_DB}
DATABASE_URL_SYSTEM=postgres://pylr_system:${SYSTEM_PW}@${PG_HOST}:${PG_PORT}/${PG_DB}
EOF
else
  info "$DB_ENV already exists, leaving it as-is."
fi

# Pull the (possibly pre-existing) app/system passwords back out so the
# ALTER ROLE step below always matches what's actually in the .env file,
# whether this is the first run or a re-run.
extract_pw() {
  # $1 = var name (DATABASE_URL_APP or DATABASE_URL_SYSTEM)
  grep "^$1=" "$DB_ENV" | sed -E "s/^$1=postgres:\/\/[^:]+:([^@]+)@.*/\1/"
}
APP_PW="$(extract_pw DATABASE_URL_APP)"
SYSTEM_PW="$(extract_pw DATABASE_URL_SYSTEM)"
[ -n "$APP_PW" ] && [ -n "$SYSTEM_PW" ] || die "Couldn't parse passwords out of $DB_ENV — check it by hand."

# ---------------------------------------------------------------------------
# 5. Install deps, build the packages the API depends on, run migrations
# ---------------------------------------------------------------------------
info "Installing dependencies (pnpm install)..."
pnpm install

info "Building shared packages..."
pnpm --filter @pylr/schemas --filter @pylr/db --filter @pylr/auth build

info "Running migrations..."
pnpm --filter @pylr/db migrate

info "Setting pylr_app / pylr_system passwords to match $DB_ENV..."
"${PSQL_ADMIN[@]}" -d "$PG_DB" -c "alter role pylr_app with password '${APP_PW}'"
"${PSQL_ADMIN[@]}" -d "$PG_DB" -c "alter role pylr_system with password '${SYSTEM_PW}'"

# ---------------------------------------------------------------------------
# 6. Optionally collect Clerk keys interactively
# ---------------------------------------------------------------------------
CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
if [ -t 0 ]; then
  echo
  info "If you have Clerk API keys ready (Clerk Dashboard → API Keys), paste them now — or just press Enter to skip and fill them in later."
  read -r -p "  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: " CLERK_PUBLISHABLE_KEY || true
  read -r -p "  CLERK_SECRET_KEY: " CLERK_SECRET_KEY || true
fi
CLERK_PUBLISHABLE_KEY="${CLERK_PUBLISHABLE_KEY:-replace_with_your_clerk_publishable_key}"
CLERK_SECRET_KEY="${CLERK_SECRET_KEY:-replace_with_your_clerk_secret_key}"

# ---------------------------------------------------------------------------
# 7. Scaffold apps/api/.env and apps/staff-web/.env.local
# ---------------------------------------------------------------------------
API_ENV="apps/api/.env"
if [ ! -f "$API_ENV" ]; then
  info "Writing $API_ENV..."
  cat > "$API_ENV" <<EOF
NODE_ENV=development
PORT=3001

DATABASE_URL_APP=postgres://pylr_app:${APP_PW}@${PG_HOST}:${PG_PORT}/${PG_DB}
DATABASE_URL_SYSTEM=postgres://pylr_system:${SYSTEM_PW}@${PG_HOST}:${PG_PORT}/${PG_DB}

CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
EOF
else
  info "$API_ENV already exists, leaving it as-is."
fi

STAFF_ENV="apps/staff-web/.env.local"
if [ ! -f "$STAFF_ENV" ]; then
  info "Writing $STAFF_ENV..."
  cat > "$STAFF_ENV" <<EOF
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}
CLERK_SECRET_KEY=${CLERK_SECRET_KEY}

API_URL=http://localhost:3001
EOF
else
  info "$STAFF_ENV already exists, leaving it as-is."
fi

# ---------------------------------------------------------------------------
# 8. Seed demo data (idempotent — safe to re-run)
# ---------------------------------------------------------------------------
info "Seeding a demo church..."
pnpm --filter @pylr/db seed

# ---------------------------------------------------------------------------
# 9. Summary
# ---------------------------------------------------------------------------
echo
info "Done. Verifying with the RLS test suite (proves tenant isolation actually holds)..."
pnpm --filter @pylr/db test

echo
info "Setup complete. Next steps:"
echo "   1. If you skipped pasting Clerk keys above, fill them into:"
echo "        $API_ENV"
echo "        $STAFF_ENV"
echo "   2. Start the app:"
echo "        pnpm --filter @pylr/api dev      # in one terminal"
echo "        pnpm --filter @pylr/staff-web dev  # in another"
echo "   3. Visit http://localhost:3000 and sign up."
echo "   4. Sync your first user + set up the webhook — see docs/LOCAL_DEV.md, steps 6-7."
