"use client";

import { TransactionsProvider } from "@/contexts/transactions-context";
import { Navbar } from "@/components/layout/navbar";
import { FooterWrapper } from "@/components/layout/footer-wrapper";
import { Toaster } from "@/components/ui/toaster";
import { Web3Providers } from "@/components/web3-providers";
import { type State } from "wagmi";

function AppLoadingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#060b14]">
      {children}
    </div>
  );
}

export function AppProviders({
  children,
  initialState,
  cookieHeader,
}: {
  children: React.ReactNode;
  initialState?: State;
  cookieHeader?: string | null;
}) {
  return (
    <Web3Providers initialState={initialState} cookieHeader={cookieHeader}>
      <TransactionsProvider>
        <AppLoadingShell>
          <Navbar />
          <main className="flex-1 pt-20">{children}</main>
          <FooterWrapper />
          <Toaster />
        </AppLoadingShell>
      </TransactionsProvider>
    </Web3Providers>
  );
}
