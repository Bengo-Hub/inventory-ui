import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  disable: true,
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    skipWaiting: false,
    clientsClaim: true,
  },
});

const nextConfig: NextConfig = {
  ...(process.env.SKIP_STANDALONE !== 'true' && { output: 'standalone' as const }),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "inventoryapi.codevertexitsolutions.com",
      },
      {
        protocol: "https",
        hostname: "accounts.codevertexitsolutions.com",
      },
      {
        protocol: "https",
        hostname: "sso.codevertexitsolutions.com",
      },
    ],
  },
  turbopack: {},
};

export default withPWA(nextConfig);
