"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import {
  TransactionTabs,
  type TransactionType,
} from "@/components/main-app/transaction-tabs";
import { SwapPanel } from "@/components/main-app/panels/swap-panel";
import { SpendPanel } from "./spend-panel";
import { AIAgentPanel } from "@/components/swap/ai-agent-panel";
import {
  TransactionHistoryIconButton,
  TransactionHistorySheet,
} from "@/components/swap/transaction-history-sheet";
import type { AgentRecommendation } from "@/lib/agent/erc8004-agent";
import type { SwapTokenSymbol } from "@/lib/swap/usdc-usdt-swap";

type TxStatus = "idle" | "loading" | "success" | "error";

interface TxState {
  status: TxStatus;
  message?: string;
}

export function AppInterface() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TransactionType>("swap");
  const [txState, setTxState] = useState<TxState>({ status: "idle" });
  const [agentRec, setAgentRec] = useState<AgentRecommendation | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatSwapParams, setChatSwapParams] = useState<{
    amount: string;
    fromToken: SwapTokenSymbol;
    toToken: SwapTokenSymbol;
    slippageBps?: number;
  } | null>(null);
  const [currentFromToken, setCurrentFromToken] =
    useState<SwapTokenSymbol>("USDC");
  const [currentToToken, setCurrentToToken] = useState<SwapTokenSymbol>("USDT");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSwapStart = useCallback(
    () => setTxState({ status: "loading" }),
    [],
  );

  const handleSwapSuccess = useCallback(() => {
    setTxState({
      status: "success",
      message: "Swap initiated successfully!",
    });
    setTimeout(() => setTxState({ status: "idle" }), 6000);
  }, []);

  const handleSwapError = useCallback((error: string) => {
    setTxState({ status: "error", message: error });
    setTimeout(() => setTxState({ status: "idle" }), 8000);
  }, []);

  if (!mounted) {
    return (
      <div className="relative z-10 w-full max-w-[420px] mx-auto space-y-3">
        <GlassCard className="p-5 md:p-6" glow hover={false}>
          <div className="h-64 flex items-center justify-center text-white/40">
            Loading...
          </div>
        </GlassCard>
      </div>
    );
  }

  const title = activeTab === "swap" ? "Swap Tokens" : "Transfer to Bank";

  return (
    <div className="relative z-10 w-full max-w-[420px] mx-auto space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
      >
        <GlassCard className="p-5 md:p-6" glow hover={true} gradient={true}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
              {title}
            </h2>
            <div className="flex items-center gap-2">
              <TransactionHistoryIconButton
                onClick={() => setHistoryOpen(true)}
              />
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-brand-green/10 border border-brand-green/30 shadow-[0_0_10px_rgba(38,161,123,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-green shadow-[0_0_5px_rgba(38,161,123,0.8)] animate-pulse" />
                <span className="text-[11px] font-bold text-brand-green tracking-wide">
                  LIVE
                </span>
              </div>
            </div>
          </div>

          <TransactionTabs activeTab={activeTab} onTabChange={setActiveTab} />

          <AnimatePresence mode="wait">
            {txState.status === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="rounded-xl bg-brand-green/[0.08] border border-brand-green/25 flex items-start gap-3 px-4 py-3"
              >
                <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-brand-green">
                  {txState.message}
                </p>
              </motion.div>
            )}
            {txState.status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="rounded-xl bg-red-500/[0.08] border border-red-500/25 flex items-start gap-3 px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-400">
                  {txState.message}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {activeTab === "swap" ? (
              <motion.div
                key="swap"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
              >
                <SwapPanel
                  onTransactionStart={handleSwapStart}
                  onTransactionSuccess={handleSwapSuccess}
                  onTransactionError={handleSwapError}
                  isLoading={txState.status === "loading"}
                  onRecommendation={setAgentRec}
                  externalSwapParams={chatSwapParams}
                />
              </motion.div>
            ) : (
              <motion.div
                key="spend"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <SpendPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      {activeTab === "swap" && (
        <AIAgentPanel
          recommendation={agentRec}
          fromToken={currentFromToken}
          toToken={currentToToken}
          onPrepareSwap={(payload) => {
            setChatSwapParams(payload);
            setCurrentFromToken(payload.fromToken);
            setCurrentToToken(payload.toToken);
          }}
        />
      )}

      <TransactionHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
