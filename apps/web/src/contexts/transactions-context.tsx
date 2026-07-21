"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  TransactionFilters,
  TransactionStats,
  TransactionUpdate,
} from "@/lib/transactions/types";
import { TransactionService } from "@/lib/transactions/service";

interface TransactionsContextType {
  transactions: Transaction[];
  getTransaction: (id: string) => Transaction | null;
  getTransactions: (filters?: TransactionFilters) => Transaction[];
  createTransaction: (
    type: TransactionType,
    quote: Omit<
      Transaction,
      "id" | "status" | "createdAt" | "updatedAt" | "retryCount" | "maxRetries"
    >,
    metadata: Omit<Transaction["metadata"], "timestamp">,
    status?: TransactionStatus,
  ) => Transaction;
  updateTransaction: (
    id: string,
    update: Omit<TransactionUpdate, "id">,
  ) => Transaction | null;
  retryTransaction: (
    id: string,
    updateFn: (
      tx: Transaction,
    ) => Promise<{ success: boolean; error?: string }>,
  ) => Promise<{
    success: boolean;
    transaction: Transaction | null;
    error?: string;
  }>;
  stats: TransactionStats;
  isLoading: boolean;
  error: Error | null;
  clearOldTransactions: (daysToKeep?: number) => number;
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(
  undefined,
);

export function TransactionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<TransactionStats>({
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    totalVolume: {},
    lastUpdated: 0,
  });

  // Initialize the service
  const service = TransactionService.getInstance();

  // Load transactions on mount
  useEffect(() => {
    const loadTransactionsInit = () => {
      try {
        setIsLoading(true);
        const txs = service.getTransactions({});
        setTransactions(txs);
        setError(null);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to load transactions");
        setError(error);
        console.error("Error loading transactions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTransactionsInit();
    // Clean up old transactions periodically
    const cleanupInterval = setInterval(
      () => {
        service.clearOldTransactions(30);
      },
      24 * 60 * 60 * 1000,
    ); // Daily cleanup

    return () => clearInterval(cleanupInterval);
  }, [service]);

  // Update stats when transactions change
  useEffect(() => {
    try {
      const newStats = service.getTransactionStats();
      setStats(newStats);
    } catch (err) {
      console.error("Error updating transaction stats:", err);
    }
  }, [transactions, service]);

  const loadTransactions = useCallback(
    (filters: TransactionFilters = {}) => {
      try {
        setIsLoading(true);
        const txs = service.getTransactions(filters);
        setTransactions(txs);
        setError(null);
        return txs;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to load transactions");
        setError(error);
        console.error("Error loading transactions:", error);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [service],
  );

  const updateStats = useCallback(() => {
    try {
      const newStats = service.getTransactionStats();
      setStats(newStats);
    } catch (err) {
      console.error("Error updating transaction stats:", err);
    }
  }, [service]);

  const getTransaction = useCallback(
    (id: string) => {
      return service.getTransaction(id);
    },
    [service],
  );

  const getTransactions = useCallback(
    (filters: TransactionFilters = {}) => {
      return service.getTransactions(filters);
    },
    [service],
  );

  const createTransaction = useCallback(
    (
      type: TransactionType,
      quote: Omit<
        Transaction,
        | "id"
        | "status"
        | "createdAt"
        | "updatedAt"
        | "retryCount"
        | "maxRetries"
      >,
      metadata: Omit<Transaction["metadata"], "timestamp">,
      status?: TransactionStatus,
    ) => {
      try {
        const tx = service.createTransaction(type, quote, metadata, status);
        setTransactions((prev) => [tx, ...prev]);
        updateStats();
        return tx;
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error("Failed to create transaction");
        setError(error);
        console.error("Error creating transaction:", error);
        throw error;
      }
    },
    [service, updateStats],
  );

  const updateTransaction = useCallback(
    (id: string, update: Omit<TransactionUpdate, "id">) => {
      try {
        const updatedTx = service.updateTransaction(id, update);
        if (updatedTx) {
          setTransactions((prev) =>
            prev.map((tx) => (tx.id === id ? updatedTx : tx)),
          );
          updateStats();
        }
        return updatedTx;
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error("Failed to update transaction");
        setError(error);
        console.error("Error updating transaction:", error);
        return null;
      }
    },
    [service, updateStats],
  );

  const retryTransaction = useCallback(
    async (
      id: string,
      updateFn: (
        tx: Transaction,
      ) => Promise<{ success: boolean; error?: string }>,
    ) => {
      try {
        const result = await service.retryTransaction(id, updateFn);
        if (result.transaction) {
          setTransactions((prev) =>
            prev.map((tx) => (tx.id === id ? result.transaction! : tx)),
          );
          updateStats();
        }
        return result;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to retry transaction");
        setError(error);
        console.error("Error retrying transaction:", error);
        return {
          success: false,
          transaction: null,
          error: error.message,
        };
      }
    },
    [service, updateStats],
  );

  const clearOldTransactions = useCallback(
    (daysToKeep: number = 30) => {
      return service.clearOldTransactions(daysToKeep);
    },
    [service],
  );

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        getTransaction,
        getTransactions,
        createTransaction,
        updateTransaction,
        retryTransaction,
        stats,
        isLoading,
        error,
        clearOldTransactions,
      }}
    >
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionsContext);
  if (context === undefined) {
    throw new Error(
      "useTransactions must be used within a TransactionsProvider",
    );
  }
  return context;
}

/**
 * Pure filter/sort/limit over a transaction array. Shared by the context hook
 * and any caller that needs to merge extra sources (e.g. server-side spends)
 * before applying the same filtering.
 */
export function applyTransactionFilters(
  transactions: Transaction[],
  filters: TransactionFilters = {},
): Transaction[] {
  let filtered = transactions.filter((tx) => {
    if (filters.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      if (!statuses.includes(tx.status)) return false;
    }

    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      if (!types.includes(tx.type)) return false;
    }

    if (filters.startDate && tx.createdAt < filters.startDate) return false;
    if (filters.endDate && tx.createdAt > filters.endDate) return false;

    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchesId = tx.id.toLowerCase().includes(search);
      const matchesFrom =
        tx.metadata.fromAddress?.toLowerCase().includes(search) || false;
      const matchesTo =
        tx.metadata.toAddress?.toLowerCase().includes(search) || false;
      const matchesProvider = (tx.provider ?? "Unknown")
        .toLowerCase()
        .includes(search);

      if (!(matchesId || matchesFrom || matchesTo || matchesProvider)) {
        return false;
      }
    }

    return true;
  });

  const sortBy = filters.sortBy || "createdAt";
  const sortOrder = filters.sortOrder || "desc";

  filtered = [...filtered].sort((a, b) => {
    const aValue = sortBy === "createdAt" ? a.createdAt : a.updatedAt;
    const bValue = sortBy === "createdAt" ? b.createdAt : b.updatedAt;
    if (sortOrder === "asc") {
      return aValue > bValue ? 1 : -1;
    }
    return aValue < bValue ? 1 : -1;
  });

  if (filters.limit) {
    const offset = filters.offset || 0;
    filtered = filtered.slice(offset, offset + filters.limit);
  }

  return filtered;
}

// Custom hook for filtering transactions
export function useFilteredTransactions(filters: TransactionFilters = {}) {
  const { transactions, isLoading, error } = useTransactions();

  const statusKey = Array.isArray(filters.status)
    ? filters.status.join(",")
    : (filters.status ?? "");
  const typeKey = Array.isArray(filters.type)
    ? filters.type.join(",")
    : (filters.type ?? "");

  const filteredTransactions = useMemo(
    () => applyTransactionFilters(transactions, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      transactions,
      statusKey,
      typeKey,
      filters.startDate,
      filters.endDate,
      filters.search,
      filters.sortBy,
      filters.sortOrder,
      filters.limit,
      filters.offset,
    ],
  );

  return {
    transactions: filteredTransactions,
    isLoading,
    error,
    count: filteredTransactions.length,
  };
}

// Custom hook for transaction stats
export function useTransactionStats() {
  const { stats, isLoading, error } = useTransactions();
  return { stats, isLoading, error };
}

// Custom hook for a single transaction
export function useSingleTransaction(id: string) {
  const { getTransaction, updateTransaction, retryTransaction } =
    useTransactions();
  const [transaction, setTransaction] = useState(() => getTransaction(id));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Update local state when the transaction changes
  useEffect(() => {
    const tx = getTransaction(id);
    if (tx) {
      setTransaction(tx);
    }
  }, [id, getTransaction]);

  const update = useCallback(
    (update: Omit<Transaction, "id">) => {
      try {
        setIsLoading(true);
        const updatedTx = updateTransaction(id, update);
        if (updatedTx) {
          setTransaction(updatedTx);
        }
        return updatedTx;
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error("Failed to update transaction");
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [id, updateTransaction],
  );

  const retry = useCallback(
    async (
      updateFn: (
        tx: Transaction,
      ) => Promise<{ success: boolean; error?: string }>,
    ) => {
      try {
        setIsLoading(true);
        const result = await retryTransaction(id, updateFn);
        if (result.transaction) {
          setTransaction(result.transaction);
        }
        return result;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to retry transaction");
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [id, retryTransaction],
  );

  return {
    transaction,
    isLoading,
    error,
    update,
    retry,
  };
}
