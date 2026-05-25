"use client";

import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TransactionsProvider } from "@/contexts/transactions-context";
import { Navbar } from "@/components/layout/navbar";
import { FooterWrapper } from "@/components/layout/footer-wrapper";
import { Toaster } from "@/components/ui/toaster";
import { type State } from "wagmi";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
  },
});

const Web3Providers = dynamic(
  () => import("./web3-providers").then((m) => m.Web3Providers),
  { ssr: false },
);

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
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
