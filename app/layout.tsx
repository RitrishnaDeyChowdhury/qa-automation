import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inspectra AI QA",
  description: "AI-powered website QA automation with Playwright and Gemini."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
