import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AeneasSoft — Proxy-Free Safe Pause & Resume Layer for AI Agents",
    template: "%s — AeneasSoft",
  },
  description:
    "Stop rogue AI agents in RAM, save their state, resume safely. The proxy-free in-process alternative to LiteLLM. 2 lines of code. Patent pending.",
  keywords: [
    "AI agent circuit breaker",
    "open source AI observability",
    "LLM cost control",
    "AI agent defense",
    "EU AI Act Article 12",
    "in-process blocking",
    "AI agent security",
  ],
  openGraph: {
    title: "AeneasSoft — Proxy-Free Safe Pause & Resume Layer for AI Agents",
    description:
      "Stop rogue AI agents in RAM, save state, resume safely. The in-process alternative to LiteLLM and Portkey. 2 lines of code. Patent pending.",
    url: "https://aeneassoft.com",
    siteName: "AeneasSoft",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AeneasSoft — Proxy-Free Safe Pause & Resume Layer for AI Agents",
    description:
      "Stop rogue AI agents in RAM, save state, resume safely. Open source. Patent pending.",
  },
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.className} ${GeistMono.variable} min-h-screen flex flex-col bg-deep-navy text-off-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
