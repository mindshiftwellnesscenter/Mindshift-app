# MindShift local-first journal storage (Next.js + Clerk + Dexie)

Journal entries and tool data are encrypted in the browser and saved to IndexedDB on the
user's device. Nothing in this layer calls a server.

## Files

| File | What it does |
|---|---|
| `lib/localDb.ts` | Dexie database `JournalAppDB` with a `journals` store (indexed by `id`, `userId`, `updatedAt`) and a `keys` store |
| `lib/localCrypto.ts` | AES-GCM 256 encryption with the Web Crypto API. One non-extractable key per Clerk user, a fresh IV per save, and the Clerk user id + entry id bound in as authenticated data |
| `hooks/useLocalJournal.ts` | `saveEntry(id, content, tags)`, `getEntry(id)`, `getAllEntries()`, `deleteEntry(id)` |
| `hooks/useIdleLogout.ts` | Signs out of Clerk after 5 minutes idle and clears the in-memory key cache |
| `components/IdleLogoutGuard.tsx` | Drop-in component that runs the idle timeout app-wide |
| `app/layout.tsx` | Shows where `ClerkProvider` and `IdleLogoutGuard` go |
| `app/journal/page.tsx` | Example journal page using the hook |
| `proxy.ts` | Clerk route protection (Next.js 16; name it `middleware.ts` on Next.js 15 or earlier) |
| `next.config.ts` | Strips all `console.*` from production builds and sets a Content Security Policy that only allows network calls to your site and Clerk |

## Install

```bash
npm install dexie @clerk/nextjs
```

Tested with Next.js 16.3, React 19.3, Dexie 4.4, and @clerk/nextjs 7.9. `next build` and
`tsc --noEmit` both pass.

## Environment variables (Vercel → Project → Settings → Environment Variables)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # safe to be public
CLERK_SECRET_KEY=sk_test_...                    # server only, never in client code
```

## Wiring it in

1. Copy `lib/`, `hooks/`, `components/`, `proxy.ts`, and the `next.config.ts` settings into your project. The
   imports use the `@/` alias (`"paths": { "@/*": ["./*"] }` in `tsconfig.json`).
2. In `app/layout.tsx`, put `<ClerkProvider>` inside `<body>` and render `<IdleLogoutGuard />` inside it.
3. Any component that reads or writes entries must be a client component (`"use client"`) and use
   `useLocalJournal()`. Never import `lib/localDb.ts` from a server component, route handler, or server action.
4. Wait for `ready` before calling the hook's functions (see `app/journal/page.tsx`).
5. Add your protected routes to `createRouteMatcher([...])` in `proxy.ts`.

## Rules that keep the promise true

- No `fetch`, server actions, analytics, or error reporting may receive entry text. If you add error
  reporting (Sentry and similar), turn off breadcrumbs and input capture.
- Never log entry text. Production builds strip all `console.*` calls anyway.
- The CSP `connect-src` in `next.config.ts` blocks the browser from sending data anywhere except your site
  and Clerk. If you add a service later, you must add it there on purpose.

## What the encryption does and doesn't protect

- **Protects:** entry text sits in IndexedDB only as ciphertext, so browsing the storage in developer tools
  or copying the database files shows nothing readable. The raw key can't be exported, and entries saved by
  one user can't be decrypted under another user's profile on the same device.
- **Doesn't protect against:** someone using the unlocked device while signed in, because the browser can
  still use the key on this site. The 5-minute idle sign-out covers most of this. For stronger protection,
  add a passcode step later that derives a wrapping key with PBKDF2 and use it to wrap the device key.

## Things to tell users

- Entries live only in that browser on that device. Clearing site data, using private browsing, or switching
  devices means they won't be there. MindShift can't restore them.
- On iPhone and iPad, Safari may clear data for sites that go unused for a while. Adding the app to the
  Home Screen (Share → Add to Home Screen) keeps it. The hook also asks the browser for persistent storage.

## HIPAA note

Keeping entries on the device means MindShift never holds them. Clerk still holds account details (name,
email, sign-in history), so you still need Clerk's Business Associate Agreement (Enterprise plan) before real
clients sign up.
