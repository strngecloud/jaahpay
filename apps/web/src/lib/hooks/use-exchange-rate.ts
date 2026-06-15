"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { fetchExchangeRate } from "@/lib/spend/api";
import type { ExchangeRateResponse } from "@/lib/spend/types";

const PLATFORM_FEE_BPS = 30; // 0.3%

export function useExchangeRate() {
  const query = useQuery<ExchangeRateResponse>({
    queryKey: ["exchange-rate"],
    queryFn: fetchExchangeRate,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // refresh every minute
    retry: 2,
  });

  const rate = query.data?.usdToNgn ?? null;

  /** Convert NGN amount to USDC (before fees) */
  const ngnToUsdc = useCallback(
    (ngn: number): number | null => {
      if (!rate) return null;
      return ngn / rate;
    },
    [rate],
  );

  /** Convert USDC amount to NGN */
  const usdcToNgn = useCallback(
    (usdc: number): number | null => {
      if (!rate) return null;
      return usdc * rate;
    },
    [rate],
  );

  /** Calculate the full quote for a given NGN amount */
  const getQuote = useCallback(
    (ngnAmount: number) => {
      if (!rate) return null;
      const usdcAmount = ngnAmount / rate;
      const platformFee = (usdcAmount * PLATFORM_FEE_BPS) / 10000;
      const totalUSDCRequired = usdcAmount + platformFee;

      return {
        ngnAmount,
        usdcAmount,
        exchangeRate: rate,
        platformFee,
        totalUSDCRequired,
        estimatedCompletionTime: "2-5 minutes",
      };
    },
    [rate],
  );

  const formattedRate = useMemo(() => {
    if (!rate) return null;
    return `₦${rate.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
  }, [rate]);

  return {
    rate,
    formattedRate,
    confidence: query.data?.confidence ?? null,
    lastUpdated: query.data?.lastUpdated ?? null,
    sources: query.data?.sources ?? [],
    isLoading: query.isLoading,
    error: query.error,
    ngnToUsdc,
    usdcToNgn,
    getQuote,
    refetch: query.refetch,
  };
}
