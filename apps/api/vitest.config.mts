import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // No unit/e2e tests exist yet for the API layer itself — the Phase 0
    // correctness-critical piece (tenant isolation) is covered by
    // packages/db/test/rls.test.ts instead, which tests the RLS policies
    // directly rather than through NestJS. Endpoint-level tests
    // (supertest against a running Nest app) are a Phase 1 fast-follow.
    passWithNoTests: true,
  },
});
