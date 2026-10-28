import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page here is per-user and dynamic, so we use the classic request-time
  // rendering model instead of Cache Components.
  serverExternalPackages: ["sharp", "@prisma/client"],
  experimental: {
    serverActions: {
      // Photos are compressed in the browser first; this matches Vercel's ~4.5 MB request cap.
      bodySizeLimit: "4.5mb",
    },
  },
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
