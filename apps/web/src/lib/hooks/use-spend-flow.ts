"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, keccak256, toHex } from "viem";
import { initiateSpend, confirmBlockchainSpend, getSpendStatus } from "@/lib/spend/api";
import { useExchangeRate } from "./use-exchange-rate";
import { SWAP_TOKENS } from "@/lib/minipay/constants";
import { RampAggregatorABI } from "@/lib/contracts/ramp-abi";
import { getRampContractAddresses } from "@/lib/contracts/helpers";
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

  // Celo Sepolia or other testnet
  if (chainId === 11142220 || chainId === 44787) {
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

  // ── Wagmi write contract hooks ──────────────────────────────────────
  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeOffRamp } = useWriteContract();

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

      const spendId = serverResponse.data.spendId;
      setTempSpendId(spendId);

      // Use the server's authoritative quote values
      const totalUSDC = serverResponse.data.totalUSDCRequired;
      const usdcAddress = getUsdcAddress(chainId);
      const rampAddresses = getRampContractAddresses(chainId);
      const rampAddress = rampAddresses.rampAggregator as `0x${string}`;

      // 2. Approve USDC transfer to ramp aggregator
      const approveAmount = parseUnits(totalUSDC.toFixed(6), 6);

      const approveTxHash = await writeApprove({
        address: usdcAddress,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [rampAddress, approveAmount],
      });

      setProcessingStep("sending");

      // 3. Call initiateOffRamp on the ramp aggregator
      const requestId = keccak256(toHex(spendId));
      const offRampAmount = parseUnits(totalUSDC.toFixed(6), 6);

      const offRampTxHash = await writeOffRamp({
        address: rampAddress,
        abi: RampAggregatorABI,
        functionName: "initiateOffRamp",
        args: [offRampAmount, "jahpay", requestId],
      });

      setTxHash(offRampTxHash);

      // 4. Confirm with server
      await confirmBlockchainSpend(spendId, offRampTxHash, requestId);

      setProcessingStep("bank-transfer");

      // 5. Poll for completion
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await getSpendStatus(spendId);
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
    writeApprove,
    writeOffRamp,
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
