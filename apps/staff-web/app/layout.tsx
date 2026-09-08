import type { ReactNode } from "react";
import { Archivo } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "@pylr/ui/src/globals.css";

// The mockup's display face for headlines/numbers/wordmark — body text
// stays system-ui (see packages/ui/src/tokens.css). Exposed as a CSS
// variable so @pylr/ui's components (which don't import next/font
// themselves — font loading is per-Next-app) can reference it.
const archivo = Archivo({ subsets: ["latin"], weight: ["700", "800"], variable: "--pylr-font-display" });

export const metadata = {
  title: "PYLR — Staff Dashboard",
  description: "Church staff dashboard: scheduling, event planner, and org administration.",
};

// Deliberately no header/chrome here: every route under
// /dashboard/[organizationId] owns its account UI via the Sidebar
// (packages/ui/src/Sidebar.tsx), /sign-in owns a full split-hero layout
// that a generic header would clash with, and proxy.ts's route matcher
// means an unauthenticated request never reaches any other page here in
// the first place (Clerk's own middleware redirect handles that before
// this ever renders).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-in">
      <html lang="en" className={archivo.variable}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
