import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["@prisma/client"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "node:async_hooks": "async_hooks",
    };
    return config;
  },
};

export default nextConfig;
