import type { ReactNode } from "react";
import { Archivo } from "next/font/google";
import "@pylr/ui/src/globals.css";

const archivo = Archivo({ subsets: ["latin"], weight: ["700", "800"], variable: "--pylr-font-display" });

export const metadata = {
  title: "PYLR",
  description: "Church events, giving, and Sunday info.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
