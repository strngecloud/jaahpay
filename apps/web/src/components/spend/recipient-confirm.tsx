"use client";

import { ArrowLeft, Shield, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { BankAvatar } from "./bank-avatar";
import type { SpendRecipient } from "@/lib/spend/types";

interface RecipientConfirmProps {
  recipient: SpendRecipient;
  onConfirm: () => void;
  onBack: () => void;
}

export function RecipientConfirm({
  recipient,
  onConfirm,
  onBack,
}: RecipientConfirmProps) {
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
        <h3 className="text-base font-bold text-white">
          Confirm Recipient
        </h3>
        <p className="text-xs text-white/40">
          Please verify the details below before continuing
        </p>
      </div>

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
              {recipient.bankName}
            </p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
        </div>

        <div className="h-px bg-white/[0.06]" />

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Account Number</span>
            <span className="text-sm font-mono font-medium text-white">
              {recipient.accountNumber}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Bank</span>
            <span className="text-sm font-medium text-white text-right max-w-[60%] truncate">
              {recipient.bankName}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Account Name</span>
            <span className="text-sm font-medium text-white text-right max-w-[60%] truncate">
              {recipient.accountName}
            </span>
          </div>
        </div>
      </motion.div>

      <div className="flex items-start gap-2 px-1">
        <Shield className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
        <p className="text-xs text-white/35 leading-relaxed">
          Account details have been verified with the receiving bank. Confirm
          only if you recognize this recipient.
        </p>
      </div>

      <motion.button
        onClick={onConfirm}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full h-12 rounded-2xl text-sm font-bold bg-gradient-to-r from-brand-blue to-brand-green text-white shadow-[0_0_20px_rgba(38,161,123,0.25)] transition-all duration-300"
      >
        Confirm Recipient
      </motion.button>
    </div>
  );
}
