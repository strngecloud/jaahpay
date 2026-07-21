"use client";

import { ArrowLeft, AlertCircle, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/utils";
import { BankAvatar } from "./bank-avatar";
import type { SpendRecipient, SpendQuote } from "@/lib/spend/types";

interface SpendReviewProps {
  recipient: SpendRecipient;
  quote: SpendQuote;
  usdcBalance: number | null;
  isLoadingBalance: boolean;
  isConnected: boolean;
  onConfirm: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function SpendReview({
  recipient,
  quote,
  usdcBalance,
  isLoadingBalance,
  isConnected,
  onConfirm,
  onBack,
  isSubmitting,
}: SpendReviewProps) {
  const { openConnectModal } = useConnectModal();
  const hasInsufficientBalance =
    usdcBalance !== null && usdcBalance < quote.totalUSDCRequired;

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        disabled={isSubmitting}
        className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors disabled:opacity-40"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="text-center space-y-1">
        <h3 className="text-base font-bold text-white">Review & Confirm</h3>
        <p className="text-xs text-white/40">
          Double-check the details before sending
        </p>
      </div>

      {/* Recipient Summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-5 space-y-4"
      >
        <div className="flex items-center gap-4">
          <BankAvatar name={recipient.bankName} />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white truncate">
              {recipient.accountName}
            </p>
            <p className="text-xs text-white/40 truncate">
              {recipient.accountNumber} • {recipient.bankName}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Financial Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-5 space-y-3"
      >
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/50">NGN Amount</span>
          <span className="text-sm font-bold text-white">
            ₦
            {quote.ngnAmount.toLocaleString("en-NG", {
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-white/50">Exchange Rate</span>
          <span className="text-sm font-mono text-white/70">
            $1 = ₦{quote.exchangeRate.toFixed(2)}
          </span>
        </div>

        <div className="h-px bg-white/[0.06]" />

        <div className="flex justify-between items-center">
          <span className="text-sm text-white/50">USDC Amount</span>
          <span className="text-sm font-bold text-white">
            {quote.usdcAmount.toFixed(2)} USDC
          </span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1">
            <span className="text-sm text-white/50">Platform Fee</span>
            <span className="text-xs text-white/30">(0.01%)</span>
          </div>
          <span className="text-sm text-white/70">
            {quote.platformFee.toFixed(2)} USDC
          </span>
        </div>

        <div className="h-px bg-white/[0.06]" />

        <div className="flex justify-between items-center">
          <span className="text-base font-bold text-white">Total Required</span>
          <span className="text-base font-bold text-brand-green">
            {quote.totalUSDCRequired.toFixed(2)} USDC
          </span>
        </div>

        {/* Balance Check */}
        {isLoadingBalance ? (
          <div className="text-xs text-white/30 text-center">
            Checking balance...
          </div>
        ) : hasInsufficientBalance ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/[0.08] border border-red-500/25">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-red-400">
                Insufficient USDC Balance
              </p>
              <p className="text-xs text-red-400/70 mt-0.5">
                You have {usdcBalance?.toFixed(2)} USDC but need{" "}
                {quote.totalUSDCRequired.toFixed(2)} USDC
              </p>
            </div>
          </div>
        ) : usdcBalance !== null ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Your USDC Balance</span>
            <span className="font-mono text-brand-green">
              {usdcBalance.toFixed(2)} USDC
            </span>
          </div>
        ) : null}
      </motion.div>

      {/* Estimated Time */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between text-xs px-1"
      >
        <span className="text-white/40">Estimated Completion</span>
        <span className="font-medium text-white/70">
          {quote.estimatedCompletionTime}
        </span>
      </motion.div>

      {/* Security Disclaimer */}
      <div className="flex items-start gap-2 px-1">
        <Shield className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
        <p className="text-xs text-white/35 leading-relaxed">
          This transaction is secured by smart contracts on the Celo blockchain.
          Once confirmed, it cannot be reversed.
        </p>
      </div>

      {!isConnected ? (
        <motion.button
          onClick={() => openConnectModal?.()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full h-12 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-blue to-brand-green text-white shadow-[0_0_20px_rgba(38,161,123,0.25)]"
        >
          Connect Wallet to Continue
        </motion.button>
      ) : (
        <motion.button
          onClick={onConfirm}
          disabled={isSubmitting || hasInsufficientBalance || isLoadingBalance}
          whileHover={
            !isSubmitting && !hasInsufficientBalance && !isLoadingBalance
              ? { scale: 1.02 }
              : {}
          }
          whileTap={
            !isSubmitting && !hasInsufficientBalance && !isLoadingBalance
              ? { scale: 0.98 }
              : {}
          }
          className={cn(
            "w-full h-12 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2",
            !isSubmitting && !hasInsufficientBalance && !isLoadingBalance
              ? "bg-gradient-to-r from-brand-blue to-brand-green text-white shadow-[0_0_20px_rgba(38,161,123,0.25)]"
              : "bg-white/[0.05] text-white/30 cursor-not-allowed",
          )}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </>
          ) : (
            "Confirm & Send"
          )}
        </motion.button>
      )}
    </div>
  );
}
