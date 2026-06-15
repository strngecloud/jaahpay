"use client";

import { useState, useMemo } from "react";
import { Search, ChevronRight, X, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BankAvatar } from "./bank-avatar";
import type { Bank } from "@/lib/spend/types";

interface BankSelectorSheetProps {
  open: boolean;
  onClose: () => void;
  banks: Bank[];
  selectedCode?: string;
  onSelect: (bank: Bank) => void;
  isLoading?: boolean;
}

export function BankSelectorSheet({
  open,
  onClose,
  banks,
  selectedCode,
  onSelect,
  isLoading,
}: BankSelectorSheetProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return banks;
    const q = query.toLowerCase();
    return banks.filter(
      (b) => b.name.toLowerCase().includes(q) || b.code.includes(q),
    );
  }, [banks, query]);

  const handleSelect = (bank: Bank) => {
    onSelect(bank);
    setQuery("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-3xl bg-[#0d111c] border border-white/[0.08] shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-base font-bold text-white">Select Bank</h3>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/[0.06] text-white/50 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <Search className="w-4 h-4 text-brand-green shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search banks..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-6">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2 py-12 text-white/40">
                  <Building2 className="w-6 h-6 animate-pulse" />
                  <span className="text-sm">Loading banks...</span>
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-white/40 py-12">
                  No banks found
                </p>
              ) : (
                filtered.map((bank) => (
                  <button
                    key={bank.code}
                    onClick={() => handleSelect(bank)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors",
                      selectedCode === bank.code
                        ? "bg-brand-green/10 border border-brand-green/20"
                        : "hover:bg-white/[0.04]",
                    )}
                  >
                    <BankAvatar name={bank.name} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {bank.name}
                      </p>
                      <p className="text-xs text-white/40">{bank.code}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
