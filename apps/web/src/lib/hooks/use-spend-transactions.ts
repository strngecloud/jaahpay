"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { fetchSpendHistory } from "@/lib/spend/api";
import { toUserFacingMessage } from "@/lib/errors/error-handler";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@/lib/transactions/types";
import type { SpendHistoryItem } from "@/lib/spend/types";

/** Spend status strings map 1:1 onto TransactionStatus; fall back to pending. */
function toTransactionStatus(status: string): TransactionStatus {
  const normalized = status.toLowerCase();
  return (Object.values(TransactionStatus) as string[]).includes(normalized)
    ? (normalized as TransactionStatus)
    : TransactionStatus.PENDING;
}

/**
 * A spend (USDC → NGN bank off-ramp) rendered in the shared Transaction shape
 * so it lists alongside local swap history using the same card + filters.
 */
function spendToTransaction(spend: SpendHistoryItem): Transaction {
  const createdMs = new Date(spend.createdAt).getTime();
  const updatedMs = spend.completedAt
    ? new Date(spend.completedAt).getTime()
    : createdMs;
  const status = toTransactionStatus(spend.status);

  return {
    id: `spend-${spend.spendId}`,
    type: TransactionType.WITHDRAWAL,
    status,
    fromAmount:
      spend.usdcAmount != null ? spend.usdcAmount.toFixed(2) : "",
    toAmount: `₦${(spend.ngnAmount ?? 0).toLocaleString("en-NG")}`,
    rate: spend.exchangeRate,
    fee: spend.platformFee != null ? String(spend.platformFee) : undefined,
    provider: spend.recipient?.accountName
      ? `To ${spend.recipient.accountName}`
      : "Bank transfer",
    metadata: {
      providerName: "Bank Transfer",
      txHash: spend.transactionHash,
      fromAddress: spend.usdcAmount != null ? "USDC" : "",
      toAddress: "",
      feeCurrency: "USDC",
      timestamp: createdMs,
      error:
        status === TransactionStatus.FAILED && spend.errorMessage
          ? {
              code: "spend_failed",
              message: toUserFacingMessage(spend.errorMessage),
              retryable: true,
            }
          : undefined,
    },
    createdAt: createdMs,
    updatedAt: updatedMs,
    retryCount: 0,
    maxRetries: 0,
  };
}

/**
 * Server-side spend history for the connected wallet, mapped to Transactions.
 * Shares the `spend-history` query cache with useSpendRecipients so both read
 * one fetch.
 */
export function useSpendTransactions() {
  const { address } = useAccount();

  const query = useQuery({
    queryKey: ["spend-history", address],
    queryFn: () => fetchSpendHistory(address!),
    enabled: !!address,
    staleTime: 1000 * 60 * 5,
  });

  const transactions = useMemo(
    () => (query.data?.spends ?? []).map(spendToTransaction),
    [query.data],
  );

  return {
    transactions,
    isLoading: query.isLoading && !!address,
    error: query.error instanceof Error ? query.error : null,
  };
}
