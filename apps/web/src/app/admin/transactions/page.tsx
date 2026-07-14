"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AddressChip,
  Callout,
  EmptyRow,
  fetchAdmin,
  formatUsd,
  LoadingBlock,
  SectionCard,
  StatusPill,
  TableShell,
} from "@/components/admin/ui";

const PAGE_SIZE = 25;
const STATUS_FILTERS = ["all", "completed", "pending", "processing", "failed", "cancelled"];

interface TxRow {
  id: string;
  user_address?: string;
  type: string;
  status: string;
  from_token?: string;
  to_token?: string;
  from_amount: string;
  to_amount: string;
  platform_fee?: string;
  tx_hash?: string;
  created_at: string;
}

interface TxResponse {
  configured: boolean;
  transactions: TxRow[];
  total: number;
  error?: string;
}

export default function AdminTransactionsPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(0);

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  });
  if (status !== "all") params.set("status", status);
  if (submittedSearch) params.set("search", submittedSearch);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-transactions", status, submittedSearch, page],
    queryFn: () => fetchAdmin<TxResponse>(`/api/admin/transactions?${params}`),
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(Math.ceil(data.total / PAGE_SIZE), 1) : 1;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
        <p className="mt-1 text-sm text-white/50">
          Every swap saved by the app, with wallet, amounts, fee, and on-chain hash.
        </p>
      </header>

      {/* Filters in one row above the table */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-[#0d111c]/80 p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(0);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs capitalize transition-colors",
                status === s
                  ? "bg-brand-blue/15 font-medium text-brand-blue"
                  : "text-white/55 hover:text-white",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <form
          className="relative ml-auto"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedSearch(search.trim());
            setPage(0);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Wallet, tx hash, or id…"
            className="h-9 w-64 rounded-xl border border-white/[0.08] bg-[#0d111c]/80 pl-9 pr-3 font-mono text-xs text-white placeholder:text-white/30 focus:border-brand-blue/50 focus:outline-none"
          />
        </form>
      </div>

      {error && <Callout tone="error">{(error as Error).message}</Callout>}
      {data && !data.configured && (
        <Callout tone="warning">{data.error || "Supabase is not configured."}</Callout>
      )}

      <SectionCard>
        {isLoading && !data ? (
          <LoadingBlock label="Loading transactions…" />
        ) : (
          <TableShell
            head={
              <>
                <th className="pb-2 pr-4 font-semibold">Status</th>
                <th className="pb-2 pr-4 font-semibold">Type</th>
                <th className="pb-2 pr-4 font-semibold">Wallet</th>
                <th className="pb-2 pr-4 text-right font-semibold">In</th>
                <th className="pb-2 pr-4 text-right font-semibold">Out</th>
                <th className="pb-2 pr-4 text-right font-semibold">Fee</th>
                <th className="pb-2 pr-4 font-semibold">Tx</th>
                <th className="pb-2 font-semibold">When</th>
              </>
            }
          >
            {(data?.transactions.length ?? 0) === 0 && (
              <EmptyRow colSpan={8} message="No transactions match these filters." />
            )}
            {data?.transactions.map((tx) => (
              <tr key={tx.id} className="text-white/80">
                <td className="py-2.5 pr-4">
                  <StatusPill status={tx.status} />
                </td>
                <td className="py-2.5 pr-4 capitalize">{tx.type}</td>
                <td className="py-2.5 pr-4">
                  <AddressChip address={tx.user_address} />
                </td>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                  {formatUsd(parseFloat(tx.from_amount || "0"))}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                  {formatUsd(parseFloat(tx.to_amount || "0"))}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-white/60">
                  {tx.platform_fee ? formatUsd(parseFloat(tx.platform_fee)) : "—"}
                </td>
                <td className="py-2.5 pr-4">
                  <AddressChip address={tx.tx_hash} explorer="tx" />
                </td>
                <td className="py-2.5 text-xs text-white/50">
                  {new Date(tx.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </TableShell>
        )}

        {data && data.total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-white/50">
            <span className="font-mono tabular-nums">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} of{" "}
              {data.total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
                className="btn-quiet h-8 px-3 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                disabled={page >= totalPages - 1}
                className="btn-quiet h-8 px-3 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
