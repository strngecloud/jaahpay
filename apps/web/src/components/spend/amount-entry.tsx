"use client";

import { ArrowLeft, Info } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SpendRecipient } from "@/lib/spend/types";

interface AmountEntryProps {
  recipient: SpendRecipient;
  ngnAmount: string;
  onNgnAmountChange: (value: string) => void;
  narration: string;
  onNarrationChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
  amountError: string | null;
  usdcEquivalent: number | null;
  exchangeRate: number | null;
  isRateLoading: boolean;
  confidence: number | null;
}

export function AmountEntry({
  recipient,
  ngnAmount,
  onNgnAmountChange,
  narration,
  onNarrationChange,
  onNext,
  onBack,
  canProceed,
  amountError,
  usdcEquivalent,
  exchangeRate,
  isRateLoading,
  confidence,
}: AmountEntryProps) {
  const handleAmountChange = (value: string) => {
    // Only allow numbers and a single decimal point
    const sanitized = value.replace(/[^\d.]/g, "");
    const parts = sanitized.split(".");
    if (parts.length > 2) return; // More than one decimal point

    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) return;

    onNgnAmountChange(sanitized);
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="text-center space-y-1">
        <h3 className="text-base font-bold text-white">Enter Amount</h3>
        <p className="text-xs text-white/40">
          Sending to {recipient.accountName}
        </p>
      </div>

      <div className="space-y-4">
        {/* NGN Amount Input */}
        <div>
          <label className="block text-xs font-medium text-white/50 mb-2">
            Amount in Naira
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-white/40">
              ₦
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={ngnAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-4 text-2xl font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green/50 transition-colors"
            />
          </div>
          {amountError && (
            <p className="mt-2 text-xs text-red-400">{amountError}</p>
          )}
          <p className="mt-1.5 text-xs text-white/30">
            Min: ₦100 • Max: ₦1,000,000
          </p>
        </div>

        {/* USDC Equivalent Display */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">You'll spend</span>
            <div className="text-right">
              <p className="text-lg font-bold text-brand-green">
                {usdcEquivalent !== null
                  ? `${usdcEquivalent.toFixed(2)} USDC`
                  : "—"}
              </p>
              <p className="text-xs text-white/30">
                {exchangeRate !== null
                  ? `≈ ${usdcEquivalent && (usdcEquivalent * 1).toFixed(2)} USD`
                  : "Loading rate..."}
              </p>
            </div>
          </div>

          {exchangeRate !== null && (
            <>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Exchange Rate</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white/70">
                    $1 = ₦{exchangeRate.toFixed(2)}
                  </span>
                  {confidence !== null && confidence < 0.8 && (
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Info className="w-3 h-3" />
                      <span className="text-[10px]">Variable</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Optional Narration */}
        <div>
          <label className="block text-xs font-medium text-white/50 mb-2">
            Narration (Optional)
          </label>
          <input
            type="text"
            value={narration}
            onChange={(e) => onNarrationChange(e.target.value)}
            placeholder="e.g., Payment for goods"
            maxLength={255}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-green/50 transition-colors"
          />
          <div className="flex justify-end mt-1">
            <span className="text-[10px] text-white/30">
              {narration.length}/255
            </span>
          </div>
        </div>
      </div>

      <motion.button
        onClick={onNext}
        disabled={!canProceed || isRateLoading}
        whileHover={canProceed && !isRateLoading ? { scale: 1.02 } : {}}
        whileTap={canProceed && !isRateLoading ? { scale: 0.98 } : {}}
        className={cn(
          "w-full h-12 rounded-2xl text-sm font-bold transition-all duration-300",
          canProceed && !isRateLoading
            ? "bg-gradient-to-r from-brand-blue to-brand-green text-white shadow-[0_0_20px_rgba(38,161,123,0.25)]"
            : "bg-white/[0.05] text-white/30 cursor-not-allowed",
        )}
      >
        {isRateLoading ? "Loading rate..." : "Continue to Review"}
      </motion.button>
    </div>
  );
}
