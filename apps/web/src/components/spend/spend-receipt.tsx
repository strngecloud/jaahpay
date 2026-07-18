"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Share2, X, ExternalLink, Check, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type SpendReceiptData,
  receiptDisplay,
  barcodePattern,
  downloadReceiptPng,
  shareReceipt,
} from "@/lib/spend/receipt";

const toneClasses = {
  green: "text-[#26a17b]",
  amber: "text-[#b58a2a]",
  red: "text-[#c0483f]",
} as const;

const toneDotClasses = {
  green: "bg-[#26a17b]",
  amber: "bg-[#b58a2a]",
  red: "bg-[#c0483f]",
} as const;

function Row({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span
        className={cn(
          "shrink-0 tracking-[0.08em]",
          big
            ? "text-[12px] font-bold text-[#16160f]"
            : "text-[11px] font-medium text-[#8a836e]",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-right break-all",
          big
            ? "text-[20px] font-bold text-[#16160f]"
            : "text-[13px] font-semibold text-[#16160f]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function DashedRule() {
  return <div className="border-t border-dashed border-[#c9c2ac] my-3" />;
}

function Barcode({ seed }: { seed: string }) {
  const bars = barcodePattern(seed);
  return (
    <div
      className="flex items-stretch h-10 w-full overflow-hidden"
      aria-hidden="true"
    >
      {bars.map((w, i) => (
        <span
          key={i}
          className="bg-[#16160f] mr-px shrink-0"
          style={{ width: `${w * 2}px`, marginRight: "3px" }}
        />
      ))}
    </div>
  );
}

/** The paper receipt card (matches the PNG renderer layout). */
export function SpendReceipt({
  data,
  className,
}: {
  data: SpendReceiptData;
  className?: string;
}) {
  const d = receiptDisplay(data);

  return (
    <div className={cn("font-mono", className)}>
      <div className="bg-[#f7f2e8] rounded-t-2xl px-6 pt-6 pb-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-bold tracking-[0.12em] text-[#16160f]">
            JAHPAY
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em]",
              toneClasses[d.statusTone],
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                toneDotClasses[d.statusTone],
              )}
            />
            {d.statusLabel}
          </span>
        </div>
        <p className="mt-2 text-[10px] tracking-[0.14em] text-[#8a836e]">
          {d.subtitle}
        </p>

        <DashedRule />

        <Row label="YOU SEND" value={d.youSend} />
        <Row label="ORACLE RATE" value={d.rate} />
        <Row label={d.feeLabel} value={d.fee} />

        <DashedRule />

        <Row label="RECIPIENT GETS" value={d.recipientGets} big />
        <Row label="BANK" value={d.bank} />
        {d.account && <Row label="ACCOUNT NAME" value={d.account} />}
        <Row label="TIME TO SETTLE" value={d.settleTime} />
        {d.reference && <Row label="REFERENCE" value={d.reference} />}

        <DashedRule />

        <Barcode seed={data.txHash || data.spendId} />

        <div className="mt-3 flex items-center justify-between text-[10px] tracking-[0.1em] text-[#8a836e]">
          {d.txShort ? (
            d.explorerUrl ? (
              <a
                href={d.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#16160f] transition-colors"
              >
                TX {d.txShort}
              </a>
            ) : (
              <span>TX {d.txShort}</span>
            )
          ) : (
            <span>{`ID ${data.spendId.slice(0, 12)}`}</span>
          )}
          {d.explorerUrl ? (
            <a
              href={d.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-[#16160f] transition-colors"
            >
              CELOSCAN <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : (
            <span>{d.dateLabel}</span>
          )}
        </div>
      </div>

      {/* Perforated (scalloped) bottom edge */}
      <div
        className="h-3 bg-[#f7f2e8]"
        style={{
          maskImage:
            "radial-gradient(circle at 9px 100%, transparent 6px, black 6.5px)",
          maskSize: "18px 100%",
          maskRepeat: "repeat-x",
          WebkitMaskImage:
            "radial-gradient(circle at 9px 100%, transparent 6px, black 6.5px)",
          WebkitMaskSize: "18px 100%",
          WebkitMaskRepeat: "repeat-x",
        }}
      />
    </div>
  );
}

/** Download / share buttons for a receipt. */
export function SpendReceiptActions({
  data,
  className,
}: {
  data: SpendReceiptData;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);

  const handleDownload = async () => {
    setBusy("download");
    try {
      await downloadReceiptPng(data);
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy("share");
    try {
      const outcome = await shareReceipt(data);
      if (outcome === "copied") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn("flex gap-3", className)}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy !== null}
        className="flex-1 h-11 rounded-2xl text-sm font-bold bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.12] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <Download className="w-4 h-4" />
        Download
      </button>
      <button
        type="button"
        onClick={handleShare}
        disabled={busy !== null}
        className="flex-1 h-11 rounded-2xl text-sm font-bold bg-gradient-to-r from-brand-blue to-brand-green text-white shadow-[0_0_20px_rgba(38,161,123,0.25)] flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Link copied
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4" />
            Share
          </>
        )}
      </button>
    </div>
  );
}

/** Modal wrapper: receipt + actions + support link. */
export function SpendReceiptModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: SpendReceiptData | null;
}) {
  return (
    <AnimatePresence>
      {open && data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-end mb-2">
              <button
                onClick={onClose}
                aria-label="Close receipt"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <SpendReceipt data={data} />
            <SpendReceiptActions data={data} className="mt-4" />

            <Link
              href={`/support?spendId=${encodeURIComponent(data.spendId)}`}
              className="mt-3 flex items-center justify-center gap-2 text-xs text-white/40 hover:text-white transition-colors"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              Need help with this transaction?
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
