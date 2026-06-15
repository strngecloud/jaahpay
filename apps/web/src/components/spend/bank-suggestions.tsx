"use client";

import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BankAvatar } from "./bank-avatar";
import type { SpendRecipient } from "@/lib/spend/types";

interface BankSuggestionsProps {
  suggestions: SpendRecipient[];
  onSelect: (recipient: SpendRecipient) => void;
  accountNumber: string;
}

export function BankSuggestions({
  suggestions,
  onSelect,
  accountNumber,
}: BankSuggestionsProps) {
  const matches = suggestions.filter((s) =>
    s.accountNumber.startsWith(accountNumber),
  );

  if (matches.length === 0 || accountNumber.length < 3) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <p className="text-xs text-white/40 mb-2 px-1">Suggested from recents</p>
        <div className="space-y-1">
          {matches.slice(0, 3).map((s) => (
            <button
              key={`${s.accountNumber}-${s.bankCode}`}
              onClick={() => onSelect(s)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-brand-blue/[0.06] border border-brand-blue/15 hover:bg-brand-blue/10 transition-colors"
            >
              <BankAvatar name={s.bankName} size="sm" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {s.accountName}
                </p>
                <p className="text-xs text-white/40 truncate">
                  {s.accountNumber} · {s.bankName}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-brand-blue/50 shrink-0" />
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
