-- RLS for Phase 2's resources/booking_requests, same tenant-scoped pattern
-- as 0001_rls.sql / 0004_scheduling_rls.sql — plus the exclusion
-- constraint that is the actual point of this phase: making a
-- double-booking of the same resource structurally impossible, the same
-- design principle RLS applied to tenant isolation.
--> statement-breakpoint

ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "resources"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "booking_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "booking_requests"
  USING ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK ("organization_id" = nullif(current_setting('app.current_org_id', true), '')::uuid);--> statement-breakpoint

-- Conflict prevention: only ONE approved booking may hold a resource for an
-- overlapping time range. Pending/denied/changes_requested/cancelled rows
-- never participate — pending requests don't reject each other; staff see
-- contention and choose. This is the DB-layer backstop; BookingRequestsService
-- .transitionStatus (apps/api/src/modules/booking/booking-requests.service.ts)
-- also does an app-layer status guard first, so a losing concurrent
-- approval of the *same* row gets a clean "already actioned" error before
-- this is ever reached — this constraint is what catches two *different*
-- rows racing to approve overlapping bookings of the same resource, which
-- the app-layer guard alone can't see (both rows are legitimately pending
-- going in). See apps/api/test/booking.test.ts's concurrency test.
ALTER TABLE "booking_requests"
  ADD COLUMN "during" tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "booking_requests"
  ADD CONSTRAINT "no_overlapping_approved_bookings"
  EXCLUDE USING gist (resource_id WITH =, during WITH &&)
  WHERE (status = 'approved');--> statement-breakpoint

CREATE INDEX "booking_requests_org_status_idx" ON "booking_requests" USING btree ("organization_id","status");
