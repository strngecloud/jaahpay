"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBanks } from "@/lib/spend/api";
import type { Bank } from "@/lib/spend/types";

interface UseBanksOptions {
  /** When false, the banks request is deferred until enabled flips true. */
  enabled?: boolean;
}

export function useBanks({ enabled = true }: UseBanksOptions = {}) {
  const query = useQuery<Bank[]>({
    queryKey: ["banks"],
    queryFn: fetchBanks,
    staleTime: 1000 * 60 * 60,
    retry: 2,
    enabled,
  });

  const getBankByCode = (code: string): Bank | undefined =>
    query.data?.find((b) => b.code === code);

  return {
    banks: query.data ?? [],
    isLoading: query.isLoading || query.isFetching,
    error: query.error,
    getBankByCode,
    refetch: query.refetch,
  };
}
