import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @pylr/ui ships raw TS/TSX source with no build step (same bundler
  // consumes it, per that package's own comment) — this is what makes
  // Next transpile it like first-party app code instead of expecting
  // pre-built JS out of node_modules.
  transpilePackages: ["@pylr/ui"],
};

export default nextConfig;
