import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // passWithNoTests stays on so `pnpm test` doesn't hard-fail for a
    // module that hasn't grown tests yet.
    passWithNoTests: true,
    testTimeout: 20_000,
  },
});
