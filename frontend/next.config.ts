import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "content.gapinc.com",
      },
      {
        protocol: "https",
        hostname: "pdimg-prod-fmv3.findmine.com",
      },
    ],
  },
};

export default nextConfig;
