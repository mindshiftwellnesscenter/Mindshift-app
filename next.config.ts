// next.config.ts
import type { NextConfig } from "next";

// Your Clerk Frontend API host (from the publishable key). Change this when you move to a
// production Clerk instance (it will look like clerk.yourdomain.com).
const CLERK_HOST = "https://assured-cobra-233.clerk.accounts.dev";

// Content Security Policy: the browser itself refuses to send data anywhere except your own
// site and Clerk. This is the technical backstop for "your data never leaves your device".
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${CLERK_HOST} https://challenges.cloudflare.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self' ${CLERK_HOST}`,
  "img-src 'self' data: blob: https://img.clerk.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://challenges.cloudflare.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Strips every console.* call from production builds, so nothing can print journal text.
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
