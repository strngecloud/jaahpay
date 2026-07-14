"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Callout,
  EmptyRow,
  fetchAdmin,
  formatUsd,
  LoadingBlock,
  OkPill,
  SectionCard,
  StatCard,
  TableShell,
} from "@/components/admin/ui";

interface BotsResponse {
  arbBot: {
    logExists: boolean;
    totalTrades: number;
    totalPnl: number;
    totalVolume: number;
    lastTrades: Record<string, unknown>[];
    config: {
      executeMode: boolean;
      walletConfigured: boolean;
      tradeSize: string;
      minTradeSize: string;
      minEdgeBps: string;
      slippageBps: string;
      pollMs: string;
      gasUsdPerLeg: string;
      countPlatformFeeAsCost: boolean;
      rpcUrl: string;
    };
  };
  sweep: { ownerKeyConfigured: boolean; sweepTo: string | null };
}

const str = (v: unknown) => (v === undefined || v === null ? "—" : String(v));

export default function AdminBotsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-bots"],
    queryFn: () => fetchAdmin<BotsResponse>("/api/admin/bots"),
    refetchInterval: 60_000,
  });

  if (isLoading) return <LoadingBlock label="Loading bot status…" />;
  if (error || !data) {
    return <Callout tone="error">{(error as Error)?.message || "Failed to load bot status"}</Callout>;
  }

  const { arbBot, sweep } = data;
  const cfg = arbBot.config;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Bots &amp; Jobs</h1>
        <p className="mt-1 text-sm text-white/50">
          The Mento ↔ Uniswap V3 arb bot and the FeeCollector sweep job.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Executed trades"
          value={arbBot.totalTrades.toLocaleString()}
          sub={arbBot.logExists ? "From .arb-bot/trades.jsonl" : "No trade log found yet"}
        />
        <StatCard
          label="Realized PnL"
          value={`$${formatUsd(arbBot.totalPnl, 4)}`}
          accent={arbBot.totalPnl >= 0 ? "green" : undefined}
        />
        <StatCard label="Traded volume" value={`$${formatUsd(arbBot.totalVolume)}`} accent="blue" />
        <StatCard
          label="Mode"
          value={cfg.executeMode ? "LIVE" : "DRY RUN"}
          sub={cfg.walletConfigured ? "Trading wallet configured" : "No trading wallet key set"}
          accent={cfg.executeMode ? "green" : undefined}
        />
      </div>

      {!cfg.walletConfigured && (
        <Callout tone="warning">
          No ARB_BOT_PRIVATE_KEY (or PRIVATE_KEY) is set — the bot can only dry-run. Fund a wallet
          with USDC/USDT inventory plus ~0.5 CELO for gas before going live.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Arb bot configuration">
          <dl className="space-y-2.5 text-sm">
            {[
              ["Trade size", `$${cfg.tradeSize} per round trip`],
              ["Minimum trade size", `$${cfg.minTradeSize}`],
              ["Required edge", `${cfg.minEdgeBps} bps (clamped ≥ 1)`],
              ["Slippage tolerance", `${cfg.slippageBps} bps per leg`],
              ["Poll interval", `${Number(cfg.pollMs) / 1000}s`],
              ["Assumed gas per leg", `$${cfg.gasUsdPerLeg}`],
              [
                "Platform fee accounting",
                cfg.countPlatformFeeAsCost ? "counted as cost (conservative)" : "recycled as revenue",
              ],
              ["RPC", cfg.rpcUrl],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <dt className="text-white/50">{label}</dt>
                <dd className="text-right font-mono text-xs tabular-nums text-white/85">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-white/40">
            Start with <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-white/70">pnpm bot:arb</code>{" "}
            (dry run) or <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-white/70">ARB_EXECUTE=1 pnpm bot:arb</code>{" "}
            (live). Full guide: docs/ARB_BOT.md.
          </p>
        </SectionCard>

        <SectionCard title="Fee sweep job">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/50">Owner key</dt>
              <dd>
                <OkPill ok={sweep.ownerKeyConfigured} labels={["configured", "missing"]} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/50">Sweep destination</dt>
              <dd className="font-mono text-xs text-white/85">
                {sweep.sweepTo || "owner address (default)"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-white/40">
            <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-white/70">pnpm bot:sweep</code>{" "}
            reports balances; add EXECUTE=1 to withdraw. Withdrawable vs stuck amounts are on the
            Fees &amp; Revenue page.
          </p>
        </SectionCard>
      </div>

      <SectionCard title="Recent trades">
        <TableShell
          head={
            <>
              <th className="pb-2 pr-4 font-semibold">When</th>
              <th className="pb-2 pr-4 font-semibold">Route</th>
              <th className="pb-2 pr-4 text-right font-semibold">Size</th>
              <th className="pb-2 text-right font-semibold">PnL</th>
            </>
          }
        >
          {arbBot.lastTrades.length === 0 && (
            <EmptyRow
              colSpan={4}
              message={
                arbBot.logExists
                  ? "Trade log is empty."
                  : "No executed trades yet — the bot writes .arb-bot/trades.jsonl after its first live trade."
              }
            />
          )}
          {arbBot.lastTrades.map((t, i) => {
            const pnl = parseFloat(str(t.physicalPnl ?? t.pnl));
            return (
              <tr key={i} className="text-white/80">
                <td className="py-2.5 pr-4 text-xs text-white/50">
                  {t.timestamp || t.time ? new Date(String(t.timestamp ?? t.time)).toLocaleString() : "—"}
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs">
                  {str(t.route ?? `${str(t.startToken)} → ${str(t.otherToken)} → ${str(t.startToken)}`)}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                  {Number.isFinite(parseFloat(str(t.amountIn ?? t.tradeSize)))
                    ? `$${formatUsd(parseFloat(str(t.amountIn ?? t.tradeSize)))}`
                    : "—"}
                </td>
                <td
                  className={`py-2.5 text-right font-mono tabular-nums ${
                    Number.isFinite(pnl) ? (pnl >= 0 ? "text-brand-green" : "text-red-400") : "text-white/40"
                  }`}
                >
                  {Number.isFinite(pnl) ? `$${formatUsd(pnl, 4)}` : "—"}
                </td>
              </tr>
            );
          })}
        </TableShell>
      </SectionCard>
    </div>
  );
}
