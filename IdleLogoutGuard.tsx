"use client";
// components/IdleLogoutGuard.tsx
// Drop this once inside <ClerkProvider> in app/layout.tsx. It renders nothing.

import { useIdleLogout } from "@/hooks/useIdleLogout";

export default function IdleLogoutGuard() {
  useIdleLogout({ timeoutMs: 5 * 60 * 1000, redirectUrl: "/sign-in" });
  return null;
}
