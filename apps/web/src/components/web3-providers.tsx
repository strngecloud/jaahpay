"use client";

/**
 * Web3 providers. Server-rendered: the wagmi config uses cookieStorage with
 * ssr:true, so connection state hydrates from the cookie header without a
 * client-only bailout.
 */

import { type ReactNode, useState, useMemo } from "react";
import "@rainbow-me/rainbowkit/styles.css";
import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider, type State, cookieToInitialState } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/auth-context";
import { getConfig } from "@/lib/wagmi-config";

const customDarkTheme = darkTheme({
  accentColor: "#7b3fe4",
  accentColorForeground: "white",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

export function Web3Providers({
  children,
  initialState,
  cookieHeader,
}: {
  children: ReactNode;
  initialState?: State;
  cookieHeader?: string | null;
}) {
  const [config] = useState(() => getConfig());
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 10,
          },
        },
      }),
  );

  // Compute initial state on client if cookie header is provided
  const computedInitialState = useMemo(() => {
    if (cookieHeader && !initialState) {
      return cookieToInitialState(config, cookieHeader);
    }
    return initialState;
  }, [config, cookieHeader, initialState]);

  return (
    <WagmiProvider config={config} initialState={computedInitialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customDarkTheme} modalSize="compact">
          <AuthProvider>{children}</AuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
