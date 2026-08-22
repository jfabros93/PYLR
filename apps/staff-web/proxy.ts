import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Every staff-dashboard route requires a signed-in Clerk session. Which
// *organization* the session can act on is decided separately, per
// request, by the API's TenantContextInterceptor — this middleware only
// gates "is someone logged in at all".
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
