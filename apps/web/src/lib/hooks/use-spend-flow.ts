"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { parseUnits, keccak256, stringToHex, parseEventLogs } from "viem";
import { initiateSpend, confirmBlockchainSpend, getSpendStatus } from "@/lib/spend/api";
import { useExchangeRate } from "./use-exchange-rate";
import { SWAP_TOKENS } from "@/lib/minipay/constants";
import { SpendRouterABI } from "@/lib/contracts/spend-router-abi";
import { getSpendRouterAddress } from "@/lib/contracts/helpers";
import type {
  SpendRecipient,
  SpendFlowStep,
  SpendQuote,
  SpendStatusResponse,
  ProcessingSubStep,
} from "@/lib/spend/types";

/** Standard ERC-20 ABI slice for approve */
const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const MIN_NGN = 100;
const MAX_NGN = 1_000_000;

function getUsdcAddress(chainId: number): `0x${string}` {
  const usdc = SWAP_TOKENS.find((t) => t.symbol === "USDC");
  if (!usdc) throw new Error("USDC token not configured");

  if (chainId === 44787) {
    return usdc.addressSepolia as `0x${string}`;
  }
  return usdc.address as `0x${string}`;
}

export function useSpendFlow() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const exchangeRate = useExchangeRate();

  // ── Flow state ──────────────────────────────────────────────────────
  const [step, setStep] = useState<SpendFlowStep>("recipient");
  const [recipient, setRecipient] = useState<SpendRecipient | null>(null);
  const [ngnAmount, setNgnAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [quote, setQuote] = useState<SpendQuote | null>(null);

  // ── Processing state ────────────────────────────────────────────────
  const [processingStep, setProcessingStep] = useState<ProcessingSubStep>("approving");
  const [tempSpendId, setTempSpendId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [spendStatus, setSpendStatus] = useState<SpendStatusResponse | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Wagmi contract hooks ────────────────────────────────────────────
  const publicClient = usePublicClient();
  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeInitiateSpend } = useWriteContract();

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup ─────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ── Amount validation ───────────────────────────────────────────────
  const parsedNgn = parseFloat(ngnAmount) || 0;
  const amountError =
    ngnAmount.length > 0 && parsedNgn > 0
      ? parsedNgn < MIN_NGN
        ? `Minimum amount is ₦${MIN_NGN.toLocaleString()}`
        : parsedNgn > MAX_NGN
          ? `Maximum amount is ₦${MAX_NGN.toLocaleString()}`
          : null
      : null;

  const currentQuote = exchangeRate.getQuote(parsedNgn);
  const canProceedToReview =
    parsedNgn >= MIN_NGN && parsedNgn <= MAX_NGN && !amountError && !!recipient && !!exchangeRate.rate;

  // ── Step navigation ─────────────────────────────────────────────────
  const handleRecipientConfirmed = useCallback((r: SpendRecipient) => {
    setRecipient(r);
    setStep("amount");
    setFlowError(null);
  }, []);

  const goToReview = useCallback(() => {
    if (!canProceedToReview || !currentQuote) return;
    setQuote(currentQuote);
    setStep("review");
  }, [canProceedToReview, currentQuote]);

  const goBackToAmount = useCallback(() => {
    setStep("amount");
    setFlowError(null);
  }, []);

  const goBackToRecipient = useCallback(() => {
    setStep("recipient");
    setNgnAmount("");
    setNarration("");
    setQuote(null);
    setFlowError(null);
  }, []);

  // ── Execute spend ───────────────────────────────────────────────────
  const executeSpend = useCallback(async () => {
    if (!recipient || !quote || !address || !isConnected) return;

    setIsSubmitting(true);
    setFlowError(null);
    setStep("processing");
    setProcessingStep("approving");

    try {
      // 1. Server-side initiation — fraud check, rate lock, DB record
      const serverResponse = await initiateSpend({
        userAddress: address,
        ngnAmount: quote.ngnAmount,
        recipientAccountNumber: recipient.accountNumber,
        recipientBankCode: recipient.bankCode,
        narration: narration || undefined,
        chain: "celo",
      });

      const serverSpendId = serverResponse.data.spendId;
      setTempSpendId(serverSpendId);

      if (!publicClient) throw new Error("Network client unavailable");

      // Use the server's authoritative quote values
      const totalUSDC = serverResponse.data.totalUSDCRequired;
      const usdcAddress = getUsdcAddress(chainId);
      const spendRouterAddress = getSpendRouterAddress(chainId);
      const spendAmount = parseUnits(totalUSDC.toFixed(6), 6);

      // 2. Approve USDC transfer to the SpendRouter escrow and wait for it
      // to land before spending the allowance.
      const approveTxHash = await writeApprove({
        address: usdcAddress,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [spendRouterAddress, spendAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

      setProcessingStep("sending");

      // 3. Escrow the USDC in the SpendRouter. The recipient hash keeps
      // bank details off-chain while still committing to them.
      const recipientHash = keccak256(
        stringToHex(
          `${recipient.bankCode}:${recipient.accountNumber}:${recipient.accountName ?? ""}`,
        ),
      );

      const spendTxHash = await writeInitiateSpend({
        address: spendRouterAddress,
        abi: SpendRouterABI,
        functionName: "initiateSpend",
        args: [spendAmount, BigInt(Math.round(quote.ngnAmount)), recipientHash],
      });

      setTxHash(spendTxHash);

      // 4. Read the on-chain spendId from the SpendInitiated event
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: spendTxHash,
      });
      if (receipt.status !== "success") {
        throw new Error("Blockchain transaction reverted");
      }

      const spendLogs = parseEventLogs({
        abi: SpendRouterABI,
        eventName: "SpendInitiated",
        logs: receipt.logs,
      });
      const onChainSpendId = spendLogs[0]?.args.spendId;
      if (onChainSpendId === undefined) {
        throw new Error("SpendInitiated event not found in receipt");
      }
      const boundSpendId = onChainSpendId.toString();

      // 5. Link the server record to the on-chain spend (the backend also
      // binds it independently from the event, so this is best-effort).
      await confirmBlockchainSpend(serverSpendId, spendTxHash, boundSpendId).catch(
        () => undefined,
      );

      setProcessingStep("bank-transfer");

      // 6. Poll for completion using the on-chain spendId
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await getSpendStatus(boundSpendId);
          setSpendStatus(status);

          if (status.status === "completed") {
            setProcessingStep("complete");
            setStep("complete");
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          } else if (status.status === "failed" || status.status === "refunded") {
            setFlowError(status.errorMessage || "Transfer failed");
            setProcessingStep("error");
            setStep("error");
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          }
        } catch {
          // Silently continue polling
        }
      }, 5000);
    } catch (err: any) {
      console.error("Spend flow error:", err);
      const message =
        err?.shortMessage || err?.message || "Transaction failed. Please try again.";
      setFlowError(message);
      setProcessingStep("error");
      setStep("error");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    recipient,
    quote,
    address,
    isConnected,
    narration,
    chainId,
    publicClient,
    writeApprove,
    writeInitiateSpend,
  ]);

  // ── Reset ───────────────────────────────────────────────────────────
  const resetFlow = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setStep("recipient");
    setRecipient(null);
    setNgnAmount("");
    setNarration("");
    setQuote(null);
    setProcessingStep("approving");
    setTempSpendId(null);
    setTxHash(null);
    setSpendStatus(null);
    setFlowError(null);
    setIsSubmitting(false);
  }, []);

  const retryFromReview = useCallback(() => {
    setFlowError(null);
    setStep("review");
    setProcessingStep("approving");
  }, []);

  return {
    // State
    step,
    recipient,
    ngnAmount,
    narration,
    quote,
    currentQuote,
    processingStep,
    tempSpendId,
    txHash,
    spendStatus,
    flowError,
    isSubmitting,
    isConnected,
    address,

    // Amount
    parsedNgn,
    amountError,
    canProceedToReview,
    setNgnAmount,
    setNarration,

    // Exchange rate
    exchangeRate,

    // Navigation
    handleRecipientConfirmed,
    goToReview,
    goBackToAmount,
    goBackToRecipient,

    // Actions
    executeSpend,
    resetFlow,
    retryFromReview,
  };
}
