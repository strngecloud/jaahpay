"use client";

import { useState } from "react";
import {
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ACCOUNT_NUMBER_LENGTH } from "@/lib/spend/constants";
import { BankSelectorSheet } from "./bank-selector-sheet";
import { BankSuggestions } from "./bank-suggestions";
import type { Bank, SpendRecipient } from "@/lib/spend/types";

interface RecipientFormProps {
  accountNumber: string;
  onAccountNumberChange: (value: string) => void;
  selectedBank?: Bank;
  onBankSelect: (bank: Bank) => void;
  accountName: string;
  isVerifying: boolean;
  verificationError: string | null;
  canProceed: boolean;
  onNext: () => void;
  banks: Bank[];
  banksLoading: boolean;
  suggestions: SpendRecipient[];
  onSuggestionSelect: (recipient: SpendRecipient) => void;
}

export function RecipientForm({
  accountNumber,
  onAccountNumberChange,
  selectedBank,
  onBankSelect,
  accountName,
  isVerifying,
  verificationError,
  canProceed,
  onNext,
  banks,
  banksLoading,
  suggestions,
  onSuggestionSelect,
}: RecipientFormProps) {
  const [bankSheetOpen, setBankSheetOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-white mb-4">Recipient Account</h3>

        <div className="space-y-4">
          {/* Account number */}
          <div>
            <input
              type="text"
              inputMode="numeric"
              value={accountNumber}
              onChange={(e) => onAccountNumberChange(e.target.value)}
              placeholder={`Enter ${ACCOUNT_NUMBER_LENGTH} digits Account Number`}
              className="w-full bg-transparent border-b border-white/[0.12] pb-3 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-green/50 transition-colors text-base"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] text-white/30 font-mono">
                {accountNumber.length}/{ACCOUNT_NUMBER_LENGTH}
              </span>
            </div>
          </div>

          <BankSuggestions
            suggestions={suggestions}
            onSelect={onSuggestionSelect}
            accountNumber={accountNumber}
          />

          {/* Bank selector */}
          <button
            onClick={() => setBankSheetOpen(true)}
            className="w-full flex items-center justify-between border-b border-white/[0.12] pb-3 text-left group transition-colors hover:border-brand-green/30"
          >
            <span
              className={cn(
                "text-base",
                selectedBank ? "text-white" : "text-white/30",
              )}
            >
              {selectedBank?.name ?? "Select Bank"}
            </span>
            <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-brand-green transition-colors" />
          </button>

          {/* Verification status */}
          {isVerifying && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-sm text-brand-blue"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying account name...
            </motion.div>
          )}

          {!isVerifying && accountName && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand-green/[0.08] border border-brand-green/20"
            >
              <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0" />
              <span className="text-sm font-medium text-brand-green">
                {accountName}
              </span>
            </motion.div>
          )}

          {!isVerifying && verificationError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-sm text-red-400"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {verificationError}
            </motion.div>
          )}
        </div>
      </div>

      <motion.button
        onClick={onNext}
        disabled={!canProceed}
        whileHover={canProceed ? { scale: 1.02 } : {}}
        whileTap={canProceed ? { scale: 0.98 } : {}}
        className={cn(
          "w-full h-12 rounded-2xl text-sm font-bold transition-all duration-300",
          canProceed
            ? "bg-gradient-to-r from-brand-blue to-brand-green text-white shadow-[0_0_20px_rgba(38,161,123,0.25)]"
            : "bg-white/[0.05] text-white/30 cursor-not-allowed",
        )}
      >
        Next
      </motion.button>

      <BankSelectorSheet
        open={bankSheetOpen}
        onClose={() => setBankSheetOpen(false)}
        banks={banks}
        selectedCode={selectedBank?.code}
        onSelect={onBankSelect}
        isLoading={banksLoading}
      />
    </div>
  );
}
