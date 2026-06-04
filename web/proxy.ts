import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk session middleware. Route-level auth handled at the page/layout
// via `await auth()` + `redirect('/sign-in')` in:
//   - app/page.tsx
//   - app/(dashboard)/layout.tsx
// (auth.protect() returns 404 by design — we want a 307 redirect, so we
// skip the middleware-level protect call and let pages do the work.)
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static assets; always run on API + Clerk paths.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
