"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AddressChip,
  Callout,
  EmptyRow,
  fetchAdmin,
  formatUsd,
  LoadingBlock,
  SectionCard,
  StatCard,
  TableShell,
} from "@/components/admin/ui";

interface FeeToken {
  symbol: string;
  address: string;
  decimals: number;
  balance: string;
  withdrawable: string;
  stuck: string;
}

interface FeesResponse {
  router: string;
  feeBps: number;
  feeCollector: string | null;
  owner: string | null;
  tokens: FeeToken[];
  error?: string;
}

export default function AdminFeesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-fees"],
    queryFn: () => fetchAdmin<FeesResponse>("/api/admin/fees"),
    refetchInterval: 60_000,
  });

  if (isLoading) return <LoadingBlock label="Reading FeeCollector on-chain…" />;
  if (error || !data) {
    return <Callout tone="error">{(error as Error)?.message || "Failed to load fees"}</Callout>;
  }

  const totalStable = data.tokens
    .filter((t) => t.symbol !== "CELO")
    .reduce((s, t) => s + parseFloat(t.balance), 0);
  const totalStuck = data.tokens.reduce((s, t) => s + parseFloat(t.stuck), 0);
  const celo = data.tokens.find((t) => t.symbol === "CELO");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Fees &amp; Revenue</h1>
        <p className="mt-1 text-sm text-white/50">
          Live balances on the FeeCollector contract — every swap routes {data.feeBps / 100}% here.
        </p>
      </header>

      {data.error && <Callout tone="error">{data.error}</Callout>}
      {!data.feeCollector && !data.error && (
        <Callout tone="warning">
          No FeeCollector found. Configure NEXT_PUBLIC_JAHPAY_ROUTER_ADDRESS or
          NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Stablecoin fees held"
          value={`$${formatUsd(totalStable)}`}
          sub="USDC + USDT on the FeeCollector"
          accent="green"
        />
        <StatCard
          label="CELO fees held"
          value={formatUsd(parseFloat(celo?.balance || "0"))}
          sub={`${formatUsd(parseFloat(celo?.withdrawable || "0"))} withdrawable now`}
        />
        <StatCard
          label="Stuck (accounting gap)"
          value={`$${formatUsd(totalStuck)}`}
          sub="Sent via plain transfer, not counted by withdrawFees()"
          accent={totalStuck > 0 ? "purple" : undefined}
        />
      </div>

      <SectionCard title="Per-token breakdown">
        <TableShell
          head={
            <>
              <th className="pb-2 pr-4 font-semibold">Token</th>
              <th className="pb-2 pr-4 font-semibold">Contract</th>
              <th className="pb-2 pr-4 text-right font-semibold">Balance</th>
              <th className="pb-2 pr-4 text-right font-semibold">Withdrawable</th>
              <th className="pb-2 text-right font-semibold">Stuck</th>
            </>
          }
        >
          {data.tokens.length === 0 && <EmptyRow colSpan={5} message="No token data available." />}
          {data.tokens.map((t) => (
            <tr key={t.symbol} className="text-white/80">
              <td className="py-2.5 pr-4 font-medium text-white">{t.symbol}</td>
              <td className="py-2.5 pr-4">
                <AddressChip address={t.address} />
              </td>
              <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                {formatUsd(parseFloat(t.balance), 4)}
              </td>
              <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-brand-green">
                {formatUsd(parseFloat(t.withdrawable), 4)}
              </td>
              <td
                className={`py-2.5 text-right font-mono tabular-nums ${
                  parseFloat(t.stuck) > 0 ? "text-amber-400" : "text-white/40"
                }`}
              >
                {formatUsd(parseFloat(t.stuck), 4)}
              </td>
            </tr>
          ))}
        </TableShell>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Contracts">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/50">JahpaySwapRouter</dt>
              <dd>
                <AddressChip address={data.router} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/50">FeeCollector</dt>
              <dd>
                <AddressChip address={data.feeCollector} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/50">FeeCollector owner</dt>
              <dd>
                <AddressChip address={data.owner} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/50">Platform fee</dt>
              <dd className="font-mono tabular-nums text-white">
                {data.feeBps} bps ({data.feeBps / 100}%)
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Sweeping fees">
          <div className="space-y-3 text-sm text-white/60">
            <p>
              Run <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-white">pnpm bot:sweep</code>{" "}
              in <span className="font-mono text-xs">apps/web</span> to report balances, then{" "}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-white">EXECUTE=1 pnpm bot:sweep</code>{" "}
              with the owner key to withdraw what the contract allows.
            </p>
            {totalStuck > 0 && (
              <Callout tone="warning">
                ${formatUsd(totalStuck)} of ERC20 fees are stuck: the router transfers fees without
                updating collectedFees, so withdrawFees() can&apos;t release them. Fix options are in
                docs/ARB_BOT.md.
              </Callout>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
