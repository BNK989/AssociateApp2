import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow all local origins for dev testing on mobile

  allowedDevOrigins: [
    "localhost:3000",
    "local-origin.dev",
    "*.local-origin.dev",
    "http://192.168.1.168:3000",
    "192.168.1.168",
    "http://192.168.1.168",
  ],
  experimental: {
  },
};

import { withPostHogConfig } from "@posthog/nextjs-config";

export default withPostHogConfig(nextConfig, {
  personalApiKey: process.env.SOURCE_MAP_UPLOAD || 'skipped',
  envId: '266458',
  host: 'https://us.i.posthog.com',
  sourcemaps: {
    enabled: !!process.env.SOURCE_MAP_UPLOAD,
  },
});
