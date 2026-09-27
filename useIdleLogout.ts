"use client";
// hooks/useIdleLogout.ts
// Signs the user out of Clerk after a period with no interaction (default 5 minutes),
// and clears the in-memory decryption key cache so nothing stays unlocked.

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { clearKeyCache } from "@/lib/localCrypto";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

export interface IdleLogoutOptions {
  /** Milliseconds of inactivity before sign-out. Default: 5 minutes. */
  timeoutMs?: number;
  /** Where to send the user after sign-out. Default: "/sign-in". */
  redirectUrl?: string;
  /** Optional: clear any decrypted text you keep in React state before sign-out. */
  onIdle?: () => void;
}

export function useIdleLogout({ timeoutMs = 5 * 60 * 1000, redirectUrl = "/sign-in", onIdle }: IdleLogoutOptions = {}) {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const lastActive = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firing = useRef(false);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!isSignedIn) return;
    firing.current = false;
    lastActive.current = Date.now();

    const logout = () => {
      if (firing.current) return;
      firing.current = true;
      try {
        onIdleRef.current?.();
      } finally {
        clearKeyCache();
        void signOut({ redirectUrl });
      }
    };

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      const remaining = timeoutMs - (Date.now() - lastActive.current);
      timer.current = setTimeout(logout, Math.max(0, remaining));
    };

    const onActivity = () => {
      lastActive.current = Date.now();
      schedule();
    };

    // Background tabs throttle timers, so re-check the clock when the tab comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastActive.current >= timeoutMs) logout();
        else schedule();
      }
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    schedule();

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [isSignedIn, timeoutMs, redirectUrl, signOut]);
}
