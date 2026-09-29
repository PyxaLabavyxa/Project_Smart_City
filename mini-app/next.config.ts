import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep warmed page code available; resident data still comes from the authenticated API.
  experimental: { staleTimes: { dynamic: 300, static: 300 } },
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
