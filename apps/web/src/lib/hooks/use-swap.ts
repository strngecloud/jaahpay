"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import {
  getSwapQuote,
  buildSwapTransaction,
  getOppositeToken,
  formatTokenAmount,
  type SwapQuote,
  type SwapTokenSymbol,
} from "@/lib/swap/usdc-usdt-swap";
import { getSwapRecommendation } from "@/lib/agent/erc8004-agent";
import type { AgentRecommendation } from "@/lib/agent/erc8004-agent";
import { SWAP_CONFIG } from "@/lib/minipay/constants";
import {
  TransactionStatus,
  TransactionType,
} from "@/lib/transactions/types";
import { useTransactions } from "@/contexts/transactions-context";

export function useSwap(onRecommendation?: (rec: AgentRecommendation) => void) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { createTransaction } = useTransactions();

  const [fromToken, setFromToken] = useState<SwapTokenSymbol>("USDC");
  const [fromAmount, setFromAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [slippageBps, setSlippageBps] = useState(SWAP_CONFIG.DEFAULT_SLIPPAGE_BPS);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [aiRec, setAiRec] = useState<AgentRecommendation | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toToken = getOppositeToken(fromToken);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsFetchingQuote(true);
      setQuoteError(null);
      try {
        const [q, rec] = await Promise.all([
          getSwapQuote(fromToken, toToken, fromAmount, slippageBps, chainId),
          getSwapRecommendation(fromAmount, fromToken, chainId),
        ]);
        setQuote(q);
        setAiRec(rec);
        setSlippageBps(rec.recommendedSlippageBps);
        onRecommendation?.(rec);
      } catch (err) {
        setQuoteError(
          err instanceof Error ? err.message : "Failed to fetch quote",
        );
        setQuote(null);
      } finally {
        setIsFetchingQuote(false);
      }
    }, SWAP_CONFIG.QUOTE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fromAmount, fromToken, toToken, slippageBps, chainId, onRecommendation]);

  const handleSwitch = useCallback(() => {
    setFromToken(toToken);
    setFromAmount(quote ? formatTokenAmount(quote.amountOutNet) : "");
    setQuote(null);
  }, [toToken, quote]);

  const executeSwap = useCallback(async () => {
    if (!quote || !address || !walletClient) return null;
    setIsSwapping(true);
    try {
      const { approval, swap } = await buildSwapTransaction(
        fromToken,
        toToken,
        fromAmount,
        address,
        slippageBps,
        chainId,
      );

      if (approval) {
        await walletClient.sendTransaction(approval as Parameters<typeof walletClient.sendTransaction>[0]);
      }

      const txHash = await walletClient.sendTransaction(
        swap.params as Parameters<typeof walletClient.sendTransaction>[0],
      );

      createTransaction(
        TransactionType.SWAP,
        {
          type: TransactionType.SWAP,
          fromAmount,
          toAmount: quote.amountOutNet,
          provider: "Mento Protocol",
          rate: quote.rate,
          fee: quote.platformFee,
          minAmount: "0",
          maxAmount: "0",
          estimatedTime: "Instant",
          metadata: {
            providerName: "Mento Protocol",
            fromAddress: fromToken,
            toAddress: toToken,
            feeCurrency: toToken,
            txHash,
            timestamp: Date.now(),
          },
        },
        {
          providerName: "Mento Protocol",
          fromAddress: fromToken,
          toAddress: toToken,
          feeCurrency: toToken,
          txHash,
        },
        TransactionStatus.COMPLETED,
      );

      try {
        await fetch("/api/transactions/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAddress: address,
            type: "swap",
            fromToken,
            toToken,
            amountIn: fromAmount,
            amountOut: quote.amountOutNet,
            platformFee: quote.platformFee,
            txHash,
            status: "success",
          }),
        });
      } catch {
        // localStorage already persisted via createTransaction
      }

      await fetch("/api/agent/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote, txHash, success: true }),
      }).catch(() => {});

      setFromAmount("");
      setQuote(null);
      return txHash;
    } catch (err) {
      await fetch("/api/agent/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote, txHash: "", success: false }),
      }).catch(() => {});
      throw err;
    } finally {
      setIsSwapping(false);
      setShowConfirm(false);
    }
  }, [
    quote,
    address,
    walletClient,
    fromToken,
    toToken,
    fromAmount,
    slippageBps,
    chainId,
    createTransaction,
  ]);

  const canSwap =
    isConnected &&
    !!quote &&
    !!fromAmount &&
    parseFloat(fromAmount) > 0 &&
    !isFetchingQuote;

  return {
    fromToken,
    setFromToken,
    fromAmount,
    setFromAmount,
    toToken,
    quote,
    isFetchingQuote,
    quoteError,
    slippageBps,
    setSlippageBps,
    showConfirm,
    setShowConfirm,
    isSwapping,
    aiRec,
    handleSwitch,
    executeSwap,
    canSwap,
    isConnected,
    chainId,
  };
}
