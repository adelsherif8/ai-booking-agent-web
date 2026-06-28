import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "The Aurelia Grand Hotel & Spa — AI Concierge",
  description:
    "The AI concierge for The Aurelia Grand Hotel & Spa: answers from the hotel knowledge base and reserves rooms by calling real tools. Next.js + OpenAI function calling.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
