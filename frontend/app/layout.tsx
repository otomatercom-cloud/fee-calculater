import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Fee Calculator", description: "Course fee calculator" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f172a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
