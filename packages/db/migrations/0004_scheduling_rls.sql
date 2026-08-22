-- RLS for the Phase 1 scheduling tables — all follow the same simple
-- tenant-scoped pattern established in 0001_rls.sql (organization_id must
-- match the transaction's current org on every command), since none of
-- them need the self-visibility carve-outs organizations/users/
-- organization_members have.
--> statement-breakpoint

ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "services"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "service_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "service_occurrences"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "plans"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "plan_speakers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "plan_speakers"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "songs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "songs"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "plan_songs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "plan_songs"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "plan_song_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "plan_song_assignments"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "plan_announcements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "plan_announcements"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "serving_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "serving_roles"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "plan_role_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "plan_role_assignments"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);
