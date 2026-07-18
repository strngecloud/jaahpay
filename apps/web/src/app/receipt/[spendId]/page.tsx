"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, LifeBuoy } from "lucide-react";
import { getSpendStatus, fetchBanks } from "@/lib/spend/api";
import {
  buildReceiptFromStatus,
  type SpendReceiptData,
} from "@/lib/spend/receipt";
import {
  SpendReceipt,
  SpendReceiptActions,
} from "@/components/spend/spend-receipt";

export const dynamic = "force-dynamic";

export default function ReceiptPage({
  params,
}: {
  params: Promise<{ spendId: string }>;
}) {
  const { spendId } = use(params);
  const [receipt, setReceipt] = useState<SpendReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const status = await getSpendStatus(decodeURIComponent(spendId));
        // Resolve the stored bank code to a display name (best effort)
        let bankName: string | undefined;
        try {
          const banks = await fetchBanks();
          bankName = banks.find(
            (b) => b.code === status.recipient?.bank,
          )?.name;
        } catch {
          // fall back to showing the raw code
        }
        if (!cancelled) {
          setReceipt(buildReceiptFromStatus(status, { bankName }));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load receipt",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [spendId]);

  return (
    <main className="flex-1 min-h-screen jahpay-bg jahpay-grid">
      <div className="absolute inset-0 -z-10 section-overlay-hero" />
      <div className="container max-w-md mx-auto px-4 py-10 relative z-10">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>

        {error ? (
          <div className="rounded-2xl bg-red-500/[0.08] border border-red-500/25 p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm text-red-400">{error}</p>
            <Link
              href="/support"
              className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              Contact support
            </Link>
          </div>
        ) : !receipt ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/50">
            <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            <p className="text-sm">Loading receipt…</p>
          </div>
        ) : (
          <>
            <SpendReceipt data={receipt} />
            <SpendReceiptActions data={receipt} className="mt-4" />
            <Link
              href={`/support?spendId=${encodeURIComponent(receipt.spendId)}`}
              className="mt-3 flex items-center justify-center gap-2 text-xs text-white/40 hover:text-white transition-colors"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              Need help with this transaction?
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
