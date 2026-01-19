import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    // Ensures Next.js treats the `web` dir as the workspace root
    root: __dirname,
  },
};

export default nextConfig;
