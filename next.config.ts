import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true, // 👈 ADD THIS LINE
  },
  eslint: {
    ignoreDuringBuilds: true, // 👈 ADD THIS TOO
  },
};

export default nextConfig;
