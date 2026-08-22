import type { ReactNode } from "react";

export const metadata = {
  title: "PYLR",
  description: "Church events, giving, and Sunday info.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
