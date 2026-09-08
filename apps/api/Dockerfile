# Build context is the REPO ROOT (not apps/api) — the pnpm workspace
# needs packages/{db,schemas,auth} available to install/build @pylr/api's
# workspace:* dependencies. Railway is configured (see railway.json) to
# build with this Dockerfile against the root context.
#
# Deliberately a single stage, not a slim multi-stage runtime image: this
# is the first-pass "get it live" Dockerfile (see docs/DEPLOYMENT.md).
# Trimming the final image to just apps/api/dist + pruned node_modules
# (via `pnpm deploy` or a multi-stage copy) is a real optimization but
# not a blocker to a working deploy, so it's left for later rather than
# risking a fragile build on the first attempt.
FROM node:20-slim AS build

WORKDIR /repo

# Corepack ships with Node 20 and reads packageManager from package.json
# (pnpm@10.33.0) to fetch the exact pinned pnpm version.
RUN corepack enable

# Copy just the manifests first so `pnpm install` is cached across builds
# that only change source, not dependencies.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/staff-web/package.json apps/staff-web/package.json
COPY apps/congregant-web/package.json apps/congregant-web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# turbo's `^build` dependency graph (turbo.json) builds
# @pylr/schemas -> @pylr/db/@pylr/auth -> @pylr/api in the right order —
# see AGENTS.md's note on why those three ship compiled dist/ output.
RUN pnpm turbo build --filter=@pylr/api...

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
