import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Every staff-dashboard route requires a signed-in Clerk session. Which
// *organization* the session can act on is decided separately, per
// request, by the API's TenantContextInterceptor — this middleware only
// gates "is someone logged in at all".
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    // Dashboard Paths still point <SignIn /> at Account Portal. Without an
    // explicit unauthenticatedUrl, protect() sends users to
    // certain-llama-6090.accounts.dev instead of the branded /sign-in page.
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    await auth.protect({ unauthenticatedUrl: signInUrl.toString() });
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
