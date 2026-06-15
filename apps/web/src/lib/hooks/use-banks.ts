"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBanks } from "@/lib/spend/api";
import type { Bank } from "@/lib/spend/types";

export function useBanks() {
  const query = useQuery<Bank[]>({
    queryKey: ["banks"],
    queryFn: fetchBanks,
    staleTime: 1000 * 60 * 60,
    retry: 2,
  });

  const getBankByCode = (code: string): Bank | undefined =>
    query.data?.find((b) => b.code === code);

  return {
    banks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    getBankByCode,
    refetch: query.refetch,
  };
}
