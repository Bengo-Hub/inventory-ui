import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  disable: true,
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Keep next-pwa's own default caching rules (static assets, pages, …) and ADD ours (below) on
  // top — without this flag, providing any runtimeCaching array REPLACES the defaults entirely.
  // PWA is currently disabled here (see `disable: true` above), so this has no effect today, but
  // is added defensively so re-enabling it doesn't silently reintroduce the CORS bug confirmed on
  // library-ui's identical setup (the generated workbox SW intercepting the local print-agent's
  // loopback fetch broke it with a CORS error — see lib/inventory/print-agent.ts).
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    skipWaiting: false,
    clientsClaim: true,
    runtimeCaching: [
      {
        urlPattern: /^http:\/\/127\.0\.0\.1(:\d+)?\//,
        handler: "NetworkOnly",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  ...(process.env.SKIP_STANDALONE !== 'true' && { output: 'standalone' as const }),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "inventoryapi.codevertexafrica.com",
      },
      {
        protocol: "https",
        hostname: "accounts.codevertexafrica.com",
      },
      {
        protocol: "https",
        hostname: "sso.codevertexafrica.com",
      },
    ],
  },
  turbopack: {},
};

export default withPWA(nextConfig);
