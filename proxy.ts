// proxy.ts  (Next.js 16+. On Next.js 15 or earlier, name this file middleware.ts instead.)
// Requires sign-in for the journal and tools. This only checks the Clerk session;
// journal data never passes through here because it never leaves the browser.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPrivate = createRouteMatcher(["/journal(.*)", "/tools(.*)", "/logs(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPrivate(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|pdf)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
