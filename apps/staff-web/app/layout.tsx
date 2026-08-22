import type { ReactNode } from "react";
import { ClerkProvider, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export const metadata = {
  title: "PYLR — Staff Dashboard",
  description: "Church staff dashboard: scheduling, event planner, and org administration.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // @clerk/nextjs removed the <SignedIn>/<SignedOut> conditional-render
  // components in this major version — checking the session server-side
  // via auth() is the current recommended replacement. Every route here
  // except /sign-in(-up) is already gated by middleware.ts, so this is
  // mainly for rendering the right header control on that one public route.
  const { userId } = await auth();

  return (
    <ClerkProvider>
      <html lang="en">
        <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 1.5rem",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <strong>PYLR</strong>
            <div>{userId ? <UserButton /> : <SignInButton />}</div>
          </header>
          <main style={{ padding: "1.5rem" }}>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
