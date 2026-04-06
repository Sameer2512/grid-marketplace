// Next.js 16: middleware is renamed to "proxy" (src/proxy.ts)
// clerkMiddleware returns a NextMiddleware which is identical to NextProxy.
// We re-export it under the name "proxy" as required by Next.js 16.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that require the user to be signed in.
// All other routes are public by default.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
]);

export const proxy = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files.
    // _next/data routes are intentionally included for security
    // (Clerk needs to validate auth on RSC data fetches too).
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
