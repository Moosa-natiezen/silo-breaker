import type { NextConfig } from "next";

const PREVIEW_HOSTNAME =
  "pv-76cbce1db81e-6c428e68-e986-44b9-a8f1-5cd790c61594.style.dev";

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
