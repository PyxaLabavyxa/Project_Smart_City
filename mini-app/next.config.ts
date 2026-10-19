import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  experimental: { staleTimes: { dynamic: 300, static: 300 } },
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
