import path from "node:path";
import type { NextConfig } from "next";

// Monorepo root (frontend/) — shared code lives outside this app's directory.
const root = path.join(__dirname, "../../");

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: root,
  turbopack: { root },
  transpilePackages: ['@familyadmin/shared'],
};

export default nextConfig;
