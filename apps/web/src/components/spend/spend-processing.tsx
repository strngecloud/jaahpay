"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  Receipt,
  LifeBuoy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ProcessingSubStep, SpendStatusResponse } from "@/lib/spend/types";
import type { SpendReceiptData } from "@/lib/spend/receipt";
import { SpendReceiptModal } from "./spend-receipt";

interface SpendProcessingProps {
  processingStep: ProcessingSubStep;
  txHash: string | null;
  spendStatus: SpendStatusResponse | null;
  error: string | null;
  receipt?: SpendReceiptData | null;
  onDone?: () => void;
  onRetry?: () => void;
}

const EXPLORER_BASE_URL = "https://celoscan.io/tx/";

interface ProcessStep {
  id: ProcessingSubStep;
  label: string;
  description: string;
}

const PROCESS_STEPS: ProcessStep[] = [
  {
    id: "approving",
    label: "Approving USDC",
    description: "Authorizing smart contract",
  },
  {
    id: "sending",
    label: "Sending to Contract",
    description: "Executing blockchain transaction",
  },
  {
    id: "bank-transfer",
    label: "Bank Transfer in Progress",
    description: "Processing payment to recipient",
  },
  {
    id: "complete",
    label: "Transfer Complete",
    description: "Payment delivered successfully",
  },
];

export function SpendProcessing({
  processingStep,
  txHash,
  spendStatus,
  error,
  receipt,
  onDone,
  onRetry,
}: SpendProcessingProps) {
  const isComplete = processingStep === "complete";
  const isError = processingStep === "error" || !!error;
  const [receiptOpen, setReceiptOpen] = useState(false);

  const getStepStatus = (
    stepId: ProcessingSubStep,
  ): "complete" | "active" | "pending" | "error" => {
    if (isError && stepId === processingStep) return "error";
    // Once the flow is done, every step is done — including the final one,
    // which equals processingStep ("complete") and would otherwise stay stuck
    // on its "active" spinner instead of turning green.
    if (isComplete) return "complete";
    if (stepId === processingStep) return "active";

    const currentIndex = PROCESS_STEPS.findIndex(
      (s) => s.id === processingStep,
    );
    const stepIndex = PROCESS_STEPS.findIndex((s) => s.id === stepId);

    return stepIndex < currentIndex ? "complete" : "pending";
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        {isComplete ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 mx-auto rounded-full bg-brand-green/20 flex items-center justify-center"
          >
            <CheckCircle2 className="w-8 h-8 text-brand-green" />
          </motion.div>
        ) : isError ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center"
          >
            <AlertCircle className="w-8 h-8 text-red-400" />
          </motion.div>
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto"
          >
            <Loader2 className="w-16 h-16 text-brand-green" />
          </motion.div>
        )}

        <h3 className="text-lg font-bold text-white">
          {isComplete
            ? "Transfer Complete!"
            : isError
              ? "Transfer Failed"
              : "Processing Transaction"}
        </h3>

        {error && (
          <p className="text-sm text-red-400 max-w-sm mx-auto">{error}</p>
        )}

        {!isError && !isComplete && (
          <p className="text-sm text-white/50">
            Please don't close this window
          </p>
        )}
      </div>

      {/* Progress Steps */}
      <div className="space-y-3">
        {PROCESS_STEPS.map((step, index) => {
          const status = getStepStatus(step.id);

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "flex items-start gap-4 p-4 rounded-xl border transition-all duration-300",
                status === "complete" &&
                  "bg-brand-green/[0.08] border-brand-green/25",
                status === "active" &&
                  "bg-brand-blue/[0.08] border-brand-blue/30",
                status === "pending" && "bg-white/[0.03] border-white/[0.06]",
                status === "error" && "bg-red-500/[0.08] border-red-500/25",
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors",
                  status === "complete" && "bg-brand-green text-white",
                  status === "active" && "bg-brand-blue text-white",
                  status === "pending" && "bg-white/10 text-white/30",
                  status === "error" && "bg-red-500 text-white",
                )}
              >
                {status === "complete" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : status === "active" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : status === "error" ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-bold">{index + 1}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    status === "complete" && "text-brand-green",
                    status === "active" && "text-brand-blue",
                    status === "pending" && "text-white/40",
                    status === "error" && "text-red-400",
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {step.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Transaction Details */}
      <AnimatePresence>
        {(txHash || spendStatus) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4 space-y-3"
          >
            {spendStatus && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/40">Amount Sent</span>
                  <span className="text-sm font-bold text-white">
                    ₦{spendStatus.ngnAmount.toLocaleString("en-NG")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/40">Recipient</span>
                  <span className="text-sm text-white/70 truncate max-w-[60%]">
                    {spendStatus.recipient?.accountName}
                  </span>
                </div>
                {spendStatus.bankReference && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/40">
                      Bank Reference
                    </span>
                    <span className="text-xs font-mono text-brand-green">
                      {spendStatus.bankReference}
                    </span>
                  </div>
                )}
              </>
            )}

            {txHash && (
              <a
                href={`${EXPLORER_BASE_URL}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 text-xs text-brand-blue hover:text-brand-green transition-colors group"
              >
                <span>View on Celoscan</span>
                <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {isComplete && receipt && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setReceiptOpen(true)}
            className="flex-1 h-12 rounded-2xl text-sm font-bold bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.12] transition-colors flex items-center justify-center gap-2"
          >
            <Receipt className="w-4 h-4" />
            View Receipt
          </motion.button>
        )}

        {isComplete && onDone && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDone}
            className="flex-1 h-12 rounded-2xl text-sm font-bold bg-gradient-to-r from-brand-blue to-brand-green text-white shadow-[0_0_20px_rgba(38,161,123,0.25)]"
          >
            Done
          </motion.button>
        )}

        {isError && onRetry && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRetry}
            className="flex-1 h-12 rounded-2xl text-sm font-bold bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.12] transition-colors"
          >
            Try Again
          </motion.button>
        )}

        {isError && onDone && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDone}
            className="flex-1 h-12 rounded-2xl text-sm font-bold bg-gradient-to-r from-brand-blue to-brand-green text-white shadow-[0_0_20px_rgba(38,161,123,0.25)]"
          >
            Close
          </motion.button>
        )}
      </div>

      {/* Support link on failure */}
      {isError && (
        <Link
          href={`/support${
            spendStatus?.spendId
              ? `?spendId=${encodeURIComponent(spendStatus.spendId)}`
              : ""
          }`}
          className="flex items-center justify-center gap-2 text-xs text-white/40 hover:text-white transition-colors"
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          Something went wrong? Contact support
        </Link>
      )}

      <SpendReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        data={receipt ?? null}
      />
    </div>
  );
}
