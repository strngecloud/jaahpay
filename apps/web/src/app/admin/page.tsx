"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AddressChip,
  Callout,
  EmptyRow,
  fetchAdmin,
  formatUsd,
  LoadingBlock,
  SectionCard,
  StatCard,
  StatusPill,
  TableShell,
} from "@/components/admin/ui";
import { VolumeChart, DailyPoint } from "@/components/admin/volume-chart";

interface Overview {
  database: { configured: boolean; error: string | null; sampled: number };
  kpis: {
    totalTransactions: number;
    completed: number;
    failed: number;
    pending: number;
    successRate: number | null;
    totalVolume: number;
    totalFees: number;
    uniqueWallets: number;
    txLast24h: number;
    volumeLast24h: number;
  };
  daily: DailyPoint[];
  recent: {
    id: string;
    user_address?: string;
    type: string;
    status: string;
    to_amount: string;
    platform_fee?: string;
    tx_hash?: string;
    created_at: string;
  }[];
  chain: {
    blockNumber: string | null;
    feeCollector: string | null;
    feeBalances: { symbol: string; balance: string }[];
  };
}

export default function AdminOverviewPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchAdmin<Overview>("/api/admin/overview"),
    refetchInterval: 60_000,
  });

  if (isLoading) return <LoadingBlock label="Loading overview…" />;
  if (error || !data) {
    return <Callout tone="error">{(error as Error)?.message || "Failed to load overview"}</Callout>;
  }

  const { kpis, chain } = data;
  const feesOnChain = chain.feeBalances
    .filter((b) => b.symbol !== "CELO")
    .reduce((sum, b) => sum + parseFloat(b.balance || "0"), 0);
  const celoFees = chain.feeBalances.find((b) => b.symbol === "CELO");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="mt-1 text-sm text-white/50">
          Swaps, revenue, and platform health across Jahpay on Celo Mainnet.
        </p>
      </header>

      {!data.database.configured && (
        <Callout tone="warning">
          Supabase isn&apos;t configured, so swap history and volume are unavailable. On-chain
          figures below are still live.
        </Callout>
      )}
      {data.database.error && <Callout tone="error">Database error: {data.database.error}</Callout>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Volume (30d sample)"
          value={`$${formatUsd(kpis.totalVolume)}`}
          sub={`$${formatUsd(kpis.volumeLast24h)} in the last 24h`}
          accent="blue"
        />
        <StatCard
          label="Platform fees earned"
          value={`$${formatUsd(kpis.totalFees)}`}
          sub={`${formatUsd(feesOnChain)} stables + ${formatUsd(parseFloat(celoFees?.balance || "0"), 2)} CELO on FeeCollector`}
          accent="green"
        />
        <StatCard
          label="Swaps"
          value={kpis.totalTransactions.toLocaleString()}
          sub={`${kpis.txLast24h} in the last 24h · ${kpis.pending} in flight`}
        />
        <StatCard
          label="Success rate"
          value={kpis.successRate === null ? "—" : `${kpis.successRate.toFixed(1)}%`}
          sub={`${kpis.completed.toLocaleString()} completed · ${kpis.failed} failed · ${kpis.uniqueWallets} wallets`}
        />
      </div>

      <SectionCard title="Daily swap volume — last 30 days (USD)">
        <VolumeChart data={data.daily} />
      </SectionCard>

      <SectionCard
        title="Recent transactions"
        action={
          <Link href="/admin/transactions" className="text-xs text-brand-blue hover:underline">
            View all
          </Link>
        }
      >
        <TableShell
          head={
            <>
              <th className="pb-2 pr-4 font-semibold">Status</th>
              <th className="pb-2 pr-4 font-semibold">Type</th>
              <th className="pb-2 pr-4 font-semibold">Wallet</th>
              <th className="pb-2 pr-4 text-right font-semibold">Amount</th>
              <th className="pb-2 pr-4 text-right font-semibold">Fee</th>
              <th className="pb-2 font-semibold">When</th>
            </>
          }
        >
          {data.recent.length === 0 && (
            <EmptyRow colSpan={6} message="No transactions recorded yet." />
          )}
          {data.recent.map((tx) => (
            <tr key={tx.id} className="text-white/80">
              <td className="py-2.5 pr-4">
                <StatusPill status={tx.status} />
              </td>
              <td className="py-2.5 pr-4 capitalize">{tx.type}</td>
              <td className="py-2.5 pr-4">
                <AddressChip address={tx.user_address} />
              </td>
              <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                ${formatUsd(parseFloat(tx.to_amount || "0"))}
              </td>
              <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-white/60">
                {tx.platform_fee ? `$${formatUsd(parseFloat(tx.platform_fee))}` : "—"}
              </td>
              <td className="py-2.5 text-xs text-white/50">
                {new Date(tx.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </TableShell>
      </SectionCard>
    </div>
  );
}
