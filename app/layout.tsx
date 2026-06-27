import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Booking Agent — Tool-Calling Front Desk",
  description:
    "A tool-calling AI agent that answers from a knowledge base and books appointments. Next.js + OpenAI function calling.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
