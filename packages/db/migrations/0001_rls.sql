-- Row-Level Security: the mechanism that makes tenant isolation a database
-- guarantee rather than an application-code convention. All policies key
-- off two session settings, set per-request (transaction-local) by
-- @pylr/db's withTenantContext / withUserContext:
--   app.current_org_id  — the org the current request is scoped to
--   app.current_user_id — the internal users.id of the caller
--
-- These policies only bind for a role that is NOT the table owner and
-- does NOT have BYPASSRLS — see 0002_roles.sql, which creates exactly
-- that role (`pylr_app`) for the API to connect as. The `pylr_system`
-- role created there IS BYPASSRLS, for the small set of legitimately
-- cross-tenant operations (Clerk webhook user sync, org-creation intake,
-- platform admin tooling).
--> statement-breakpoint

-- organizations: the tenant root.
--
-- INSERT and DELETE have NO policy for pylr_app at all — under RLS that
-- means pylr_app cannot create or delete an org under any circumstances,
-- full stop. Org creation is inherently a "no tenant context exists yet"
-- operation, and Postgres RLS requires INSERT ... RETURNING to *also*
-- satisfy the table's SELECT policy for the row being returned — which is
-- structurally impossible for pylr_app pre-creation (there is no org id
-- to scope to yet). Rather than carve an "insert allowed when unscoped"
-- exception into the policy (which turned out to still fail on
-- `RETURNING`, and would leave the door open to writing organizations
-- from *any* unscoped connection), org creation goes through
-- SYSTEM_DB (`pylr_system`, BYPASSRLS) — see
-- OrganizationsService.createOrganization. Deletion is deliberately just
-- as restricted; that's a platform-admin operation, not a per-request one.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- SELECT allows either the org currently scoped to this transaction, OR
-- any org the caller is an ACTIVE member of regardless of current scope —
-- the latter is what makes "list the orgs I belong to, with their names/
-- branding" (GET /organizations/me) work via withUserContext, which sets
-- only app.current_user_id and no org context at all.
CREATE POLICY "organizations_select" ON "organizations"
  FOR SELECT
  USING (
    "id" = nullif(current_setting('app.current_org_id', true), '')::uuid
    OR "id" IN (
      SELECT "organization_id" FROM "organization_members"
      WHERE "user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid
        AND "status" = 'active'
    )
  );--> statement-breakpoint

-- Editing an org's own settings (name, branding, timezone) happens from
-- within a normal tenant-scoped request, unlike creation/deletion.
CREATE POLICY "organizations_update" ON "organizations"
  FOR UPDATE
  USING ("id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

-- Simple tenant-scoped tables: one row per table, same predicate on every
-- command. A row can only be read, written, or targeted for update/delete
-- when its organization_id matches the transaction's current org.
ALTER TABLE "campuses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "campuses"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "people"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "teams"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

-- team_members carries organization_id denormalized from teams.organization_id
-- (kept in sync by TeamsService at insert time) specifically so this policy
-- can be a plain column comparison instead of a subquery join.
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "team_members"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

-- organization_members: mostly the simple tenant-scoped pattern, but SELECT
-- additionally allows a user to see their OWN membership rows across every
-- org (not just the currently-scoped one) — this is what makes "list the
-- organizations I belong to" possible without first knowing which org to
-- scope to. WITH CHECK has no such carve-out: writes (invites, role
-- changes) always require the org to actually be the current tenant
-- context, so this can't be used to self-assign membership in an
-- arbitrary org.
ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "organization_members"
  USING (
    "organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid
    OR "user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid
  )
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

-- users: the global identity table. No INSERT/UPDATE/DELETE policy is
-- defined for pylr_app at all, which — under RLS — means pylr_app cannot
-- write to this table under any circumstances; only pylr_system (the
-- Clerk webhook handler) may. SELECT allows a caller to see themselves,
-- plus anyone who is a member of the org currently scoped (needed to
-- render staff/team member lists by name).
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "users_select" ON "users"
  FOR SELECT
  USING (
    "id" = nullif(current_setting('app.current_user_id', true), '')::uuid
    OR "id" IN (
      SELECT "user_id" FROM "organization_members"
      WHERE "organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid
    )
  );
