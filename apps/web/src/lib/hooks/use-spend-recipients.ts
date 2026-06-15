"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { fetchSpendHistory } from "@/lib/spend/api";
import { FAVOURITES_STORAGE_KEY } from "@/lib/spend/constants";
import type { Bank, RecipientListTab, SpendRecipient } from "@/lib/spend/types";

function loadFavourites(): SpendRecipient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVOURITES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavourites(favourites: SpendRecipient[]) {
  localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(favourites));
}

export function useSpendRecipients(banks: Bank[]) {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<RecipientListTab>("recents");
  const [favourites, setFavourites] = useState<SpendRecipient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setFavourites(loadFavourites());
  }, []);

  const historyQuery = useQuery({
    queryKey: ["spend-history", address],
    queryFn: () => fetchSpendHistory(address!),
    enabled: !!address,
    staleTime: 1000 * 60 * 5,
  });

  const getBankName = useCallback(
    (code: string) => banks.find((b) => b.code === code)?.name ?? code,
    [banks],
  );

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const items: SpendRecipient[] = [];

    for (const spend of historyQuery.data?.spends ?? []) {
      if (!spend.recipient?.accountNumber || !spend.recipient.bank) continue;
      const key = `${spend.recipient.accountNumber}-${spend.recipient.bank}`;
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        accountNumber: spend.recipient.accountNumber,
        bankCode: spend.recipient.bank,
        bankName: getBankName(spend.recipient.bank),
        accountName: spend.recipient.accountName || "Unknown",
      });
    }

    return items;
  }, [historyQuery.data, getBankName]);

  const bankSuggestions = useMemo(() => {
    if (recents.length === 0) return [];
    return recents;
  }, [recents]);

  const filteredList = useMemo(() => {
    const source = activeTab === "recents" ? recents : favourites;
    if (!searchQuery.trim()) return source;

    const q = searchQuery.toLowerCase();
    return source.filter(
      (r) =>
        r.accountName.toLowerCase().includes(q) ||
        r.accountNumber.includes(q) ||
        r.bankName.toLowerCase().includes(q),
    );
  }, [activeTab, recents, favourites, searchQuery]);

  const toggleFavourite = useCallback((recipient: SpendRecipient) => {
    setFavourites((prev) => {
      const key = `${recipient.accountNumber}-${recipient.bankCode}`;
      const exists = prev.some(
        (f) => `${f.accountNumber}-${f.bankCode}` === key,
      );
      const next = exists
        ? prev.filter((f) => `${f.accountNumber}-${f.bankCode}` !== key)
        : [...prev, recipient];
      saveFavourites(next);
      return next;
    });
  }, []);

  const isFavourite = useCallback(
    (recipient: SpendRecipient) =>
      favourites.some(
        (f) =>
          f.accountNumber === recipient.accountNumber &&
          f.bankCode === recipient.bankCode,
      ),
    [favourites],
  );

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    recents,
    favourites,
    filteredList,
    bankSuggestions,
    isLoading: historyQuery.isLoading,
    toggleFavourite,
    isFavourite,
  };
}
