import type { Metadata } from "next";
import {
  Space_Grotesk,
  Bricolage_Grotesque,
  IBM_Plex_Mono,
} from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { headers } from "next/headers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jahpay — Stablecoin Swaps & Bank Payouts on Celo",
  description:
    "Swap USDC and USDT at oracle-priced rates, send Naira to any Nigerian bank, and get AI-guided execution from an ERC-8004 agent — all on Celo.",
  openGraph: {
    title: "Jahpay — Stablecoin Swaps & Bank Payouts on Celo",
    description:
      "Oracle-priced USDC ↔ USDT swaps, NGN bank payouts, and an on-chain AI agent. Non-custodial, 0.3% flat fee.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieHeader = (await headers()).get("cookie");

  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${bricolage.variable} ${plexMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AppProviders cookieHeader={cookieHeader}>{children}</AppProviders>
      </body>
    </html>
  );
}
