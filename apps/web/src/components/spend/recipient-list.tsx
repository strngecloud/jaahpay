"use client";

import { useState } from "react";
import { Search, ChevronRight, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BankAvatar } from "./bank-avatar";
import type { RecipientListTab, SpendRecipient } from "@/lib/spend/types";

interface RecipientListProps {
  activeTab: RecipientListTab;
  onTabChange: (tab: RecipientListTab) => void;
  recipients: SpendRecipient[];
  onSelect: (recipient: SpendRecipient) => void;
  onToggleFavourite: (recipient: SpendRecipient) => void;
  isFavourite: (recipient: SpendRecipient) => boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading?: boolean;
}

export function RecipientList({
  activeTab,
  onTabChange,
  recipients,
  onSelect,
  onToggleFavourite,
  isFavourite,
  searchQuery,
  onSearchChange,
  isLoading,
}: RecipientListProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const displayList = recipients.slice(0, 5);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0">
        <div className="flex gap-4">
          {(["recents", "favourites"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className="relative pb-2.5"
            >
              <span
                className={cn(
                  "text-sm font-medium capitalize transition-colors",
                  activeTab === tab ? "text-brand-green" : "text-white/40",
                )}
              >
                {tab}
              </span>
              {activeTab === tab && (
                <motion.div
                  layoutId="recipientTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            searchOpen
              ? "text-brand-green bg-brand-green/10"
              : "text-brand-green/60 hover:text-brand-green",
          )}
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search recipients..."
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-green/30"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="px-2 py-1">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-white/30">
            Loading...
          </div>
        ) : displayList.length === 0 ? (
          <div className="py-8 text-center text-sm text-white/30">
            {activeTab === "recents"
              ? "No recent transfers yet"
              : "No favourites saved"}
          </div>
        ) : (
          displayList.map((recipient, i) => (
            <div key={`${recipient.accountNumber}-${recipient.bankCode}`}>
              <div className="flex items-center gap-1 px-1 py-1 rounded-xl hover:bg-white/[0.04] transition-colors group">
                <button
                  onClick={() => onSelect(recipient)}
                  className="flex-1 flex items-center gap-3 px-2 py-2 min-w-0"
                >
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {recipient.accountName}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {recipient.accountNumber} {recipient.bankName}
                    </p>
                  </div>
                  <BankAvatar name={recipient.bankName} size="sm" />
                </button>
                <button
                  onClick={() => onToggleFavourite(recipient)}
                  className="p-1.5 rounded-lg opacity-60 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Star
                    className={cn(
                      "w-3.5 h-3.5",
                      isFavourite(recipient)
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-white/30",
                    )}
                  />
                </button>
              </div>
              {i < displayList.length - 1 && (
                <div className="mx-3 h-px bg-white/[0.05]" />
              )}
            </div>
          ))
        )}
      </div>

      {recipients.length > 5 && (
        <div className="flex justify-center py-3 border-t border-white/[0.05]">
          <button className="flex items-center gap-1 px-4 py-1.5 rounded-full bg-white/[0.04] text-xs text-white/50 hover:text-white/70 transition-colors">
            View All
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
