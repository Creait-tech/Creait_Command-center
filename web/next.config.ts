import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Transcript uploads (lib/assessment-transcript-actions.ts) accept 4 MB
      // files; the framework default is 1 MB and Vercel's ceiling is 4.5 MB.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
