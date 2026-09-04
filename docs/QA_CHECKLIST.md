# Post-deployment QA checklist

Run this against the live deployment once all **Go-Live Deployment** tasks
are done (see the Notion board — link in `docs/PROJECT_STATUS.md`). It's
split into three passes: **functional** (does it work), **regression /
security** (does it fail the way it's supposed to, not some other way),
and **performance baseline** (what's normal right now, so a future
slowdown is measurable instead of a vibe).

Test against the real production URLs — Railway API, `pylr-staff-web`,
`pylr-congregant-web` — not local dev. Use two real people if possible
(two Clerk accounts, two orgs) so cross-tenant checks are real, not
theoretical.

A few of these intentionally fail today — that's not a bug, it's a
documented gap (marked **[known gap]** below, cross-referenced to
`docs/PROJECT_STATUS.md`). Don't file those as new findings; do confirm
they fail the *expected* way, not some other way.

## 1. Infra sanity

- [ ] `GET https://pylr-production.up.railway.app/health` → 200,
      `{"status":"ok","service":"@pylr/api"}`
- [ ] `pylr-staff-web` production domain loads, correct branch/commit
      (check the Vercel deployment inspector matches the latest
      `phase2s-design-update` commit you expect)
- [ ] `pylr-congregant-web` production domain loads the **new** design
      (not the stale pre-2.1 build)
- [ ] Both Vercel apps: no console errors on initial load (open devtools)
- [ ] Clerk dashboard → Domains includes both Vercel production domains

## 2. Auth & onboarding

- [ ] Sign in with the already-synced owner account → lands on dashboard
      with real org data (not a loading/error state)
- [ ] Sign out → redirected to sign-in; visiting a `/dashboard/...` URL
      while signed out redirects to sign-in (not a 500 or blank page)
- [ ] **[known gap]** Sign up a *brand-new* Clerk account → first API call
      (`/organizations/me`) should 401 with "no account found" until the
      manual sync script (`docs/LOCAL_DEV.md` step 6) runs against the
      Railway DB. Confirm it fails this specific way, not some other way
      — then run the sync script and confirm the same account now works.
- [ ] After manual sync, that new user can complete onboarding (create an
      org, becomes `org_admin`)

## 3. Cross-tenant isolation (do this for real, not just trust the RLS tests)

- [ ] User A (member of Org A only) hits an Org B API route with Org B's
      real ID (e.g. `GET /organizations/<org-b-id>/people`) → 403/404, not
      Org B's data
- [ ] User A cannot see Org B in any org switcher/list in the UI
- [ ] `team_member` (not `team_leader`) attempts to submit a booking
      request → blocked (403) — this is a deliberate Phase 2 restriction,
      confirm it's actually enforced live, not just in the local test
      suite

## 4. Scheduling (Phase 1)

- [ ] Create a service with a weekly `recurrenceRule`
- [ ] Generate occurrences → dates land where expected
- [ ] **[known gap]** Occurrence times are UTC, not the org's local
      timezone (`docs/PROJECT_STATUS.md`) — confirm this is the actual
      live behavior so it's not silently "fixed" or silently worse
- [ ] Build a plan: add a speaker, a song, an announcement, a serving-role
      assignment
- [ ] The assigned person can confirm/decline their own assignment from
      "My Assignments"
- [ ] Publish a plan → status/visibility changes as expected
- [ ] Team B cannot see or edit Team A's services/plans

## 5. Event planner / booking (Phase 2) — the highest-risk area to verify live

- [ ] Create a resource (a room)
- [ ] Submit a booking request as a `team_leader`
- [ ] Approve it → status flips to `approved`
- [ ] Deny / request-changes / cancel another request → correct status
      transitions, no crash
- [ ] **Double-booking test (real Postgres exclusion constraint, not the
      local suite):** submit two overlapping requests for the *same*
      resource, approve the first, then approve the second → expect a
      clean 409 conflict, not a 500 or a silent double-approval. This is
      the single most important live check — it's the whole point of the
      GiST exclusion constraint, and prod is a different Postgres instance
      than what the test suite ran against.
- [ ] Generate occurrences for a service with `defaultResourceId` set →
      confirm the room reservation lands as `pending` in the
      booking-requests queue, **not** auto-approved (deliberate: one
      approval path everywhere)

## 6. Design system / UI (Phase 2.1)

- [ ] Dashboard stat tiles show correct live counts (occurrences this
      week, pending bookings + conflict count, my assignments needing a
      response, people/teams count)
- [ ] Resources calendar (multi-resource week grid) renders and correctly
      flags overlapping bookings
- [ ] Sidebar nav highlights the active route correctly across a few pages
- [ ] Quick cross-browser smoke: Chrome + Safari at minimum (Clerk's
      widget and the Archivo font are the two things most likely to
      differ)
- [ ] Resize to a narrow viewport — dashboard shouldn't break outright
      (not optimized for mobile yet, but shouldn't be broken either)

## 7. congregant-web

- [ ] Landing page loads, no console errors
- [ ] `/c/[slug]` with a real org slug resolves; an invalid slug 404s
      cleanly instead of crashing

## 8. Performance baseline (record actual numbers — this is the point)

Capture these once and save them (Notion task or a new
`docs/PERFORMANCE_BASELINE.md`) so a later regression is measurable, not
a feeling:

- [ ] API response time, p50/p95, for the 3-4 endpoints the dashboard
      hits on load (`/organizations/me`, occurrences list, booking-requests
      list, people list) — `curl -w "%{time_total}\n" -o /dev/null -s <url>`
      run ~20x per endpoint is enough for a rough baseline
- [ ] staff-web dashboard: Time to First Byte and full page load, from
      Vercel's own deployment analytics or browser devtools Network tab
- [ ] Railway API cold-start behavior — does the service sleep on the
      current plan, and if so, what's the first-request latency after
      idle?
- [ ] Railway service CPU/memory under light load (Railway dashboard
      metrics — `mcp__Railway__get-service-metrics` if run from a Claude
      Code session)
- [ ] Rough concurrent-load smoke: fire ~10 concurrent requests at the
      booking-request approval endpoint and confirm latency doesn't
      fall over (this also doubles as a live stress test of the
      exclusion-constraint path under contention)

## 9. What to do with findings

- **Something in sections 1-7 fails in a way not listed as a known gap**
  → real bug, file it (Notion task under **Go-Live Deployment** or a new
  **Bugs Found in QA** project, whichever exists at the time).
- **Section 8 numbers** → save them as the baseline. Anything meaningfully
  slower later is the signal to open an optimization task, not a guess.
- **A known gap behaves differently than documented** → flag loudly, that
  usually means something else broke in a way that happens to look like
  the known gap.
