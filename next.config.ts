import type { NextConfig } from "next";

const PREVIEW_HOSTNAME =
  "pv-76cbce1db81e-804c445a-8fff-429e-bb7e-5a9eac12a94c.style.dev";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow the Cloud preview origin to reach the dev server (Next blocks
  // cross-origin dev requests by default).
  allowedDevOrigins: [PREVIEW_HOSTNAME],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
