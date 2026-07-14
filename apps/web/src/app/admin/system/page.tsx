"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AddressChip,
  Callout,
  fetchAdmin,
  LoadingBlock,
  OkPill,
  SectionCard,
} from "@/components/admin/ui";

interface SystemResponse {
  services: {
    rpc: { ok: boolean; blockNumber: string | null; latencyMs: number; url: string; error?: string };
    spendServer: {
      ok: boolean;
      configured: boolean;
      status?: number;
      latencyMs?: number;
      url: string | null;
      error?: string;
    };
    supabase: { ok: boolean; configured: boolean; serviceRole: boolean };
    sentry: { configured: boolean; enabled: boolean };
  };
  agent: { id: string | null; registered: boolean; chainId: number };
  contracts: Record<string, string | null>;
  tokens: { symbol: string; address: string; decimals: number }[];
  env: string;
}

const CONTRACT_LABELS: Record<string, string> = {
  jahpaySwapRouter: "JahpaySwapRouter (proxy)",
  feeCollector: "FeeCollector",
  uniswapSwapRouter: "Uniswap V3 SwapRouter02",
  uniswapQuoterV2: "Uniswap V3 QuoterV2",
  erc8004IdentityRegistry: "ERC-8004 Identity Registry",
  erc8004ReputationRegistry: "ERC-8004 Reputation Registry",
  erc8004ValidationRegistry: "ERC-8004 Validation Registry",
};

const ZERO = "0x0000000000000000000000000000000000000000";

export default function AdminSystemPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-system"],
    queryFn: () => fetchAdmin<SystemResponse>("/api/admin/system"),
    refetchInterval: 60_000,
  });

  if (isLoading) return <LoadingBlock label="Running health checks…" />;
  if (error || !data) {
    return <Callout tone="error">{(error as Error)?.message || "Failed to load system status"}</Callout>;
  }

  const { services } = data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">System</h1>
          <p className="mt-1 text-sm text-white/50">
            Service health, deployed contracts, and environment for{" "}
            <span className="font-mono text-xs">{data.env}</span>.
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="btn-quiet h-9 px-4 text-xs">
          {isFetching ? "Checking…" : "Re-run checks"}
        </button>
      </header>

      <SectionCard title="Services">
        <ul className="divide-y divide-white/[0.05]">
          <li className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="text-sm text-white">Celo RPC</p>
              <p className="font-mono text-xs text-white/40">{services.rpc.url}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums text-white/50">
                {services.rpc.ok
                  ? `block #${Number(services.rpc.blockNumber).toLocaleString()} · ${services.rpc.latencyMs}ms`
                  : services.rpc.error}
              </span>
              <OkPill ok={services.rpc.ok} />
            </div>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="text-sm text-white">Spend server (NestJS)</p>
              <p className="font-mono text-xs text-white/40">
                {services.spendServer.url || "NEXT_PUBLIC_SPEND_API_URL not set"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums text-white/50">
                {services.spendServer.ok
                  ? `${services.spendServer.latencyMs}ms`
                  : services.spendServer.error || "not configured"}
              </span>
              <OkPill ok={services.spendServer.ok} />
            </div>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="text-sm text-white">Supabase</p>
              <p className="font-mono text-xs text-white/40">
                {services.supabase.serviceRole ? "service-role key" : "publishable key"}
              </p>
            </div>
            <OkPill ok={services.supabase.ok} labels={["connected", "not configured"]} />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="text-sm text-white">Sentry</p>
              <p className="font-mono text-xs text-white/40">
                {services.sentry.enabled ? "reporting enabled" : "configured but disabled"}
              </p>
            </div>
            <OkPill ok={services.sentry.configured} labels={["configured", "not configured"]} />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="text-sm text-white">ERC-8004 Agent</p>
              <p className="font-mono text-xs text-white/40">
                {data.agent.id ? `agent #${data.agent.id} on chain ${data.agent.chainId}` : "not registered"}
              </p>
            </div>
            <OkPill ok={data.agent.registered} labels={["registered", "not registered"]} />
          </li>
        </ul>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Deployed contracts">
          <dl className="space-y-3 text-sm">
            {Object.entries(data.contracts).map(([key, address]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <dt className="text-white/50">{CONTRACT_LABELS[key] || key}</dt>
                <dd>
                  {address && address !== ZERO ? (
                    <AddressChip address={address} />
                  ) : (
                    <span className="text-xs text-amber-400">not set</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard title="Tokens">
          <dl className="space-y-3 text-sm">
            {data.tokens.map((t) => (
              <div key={t.symbol} className="flex items-center justify-between gap-4">
                <dt className="text-white/50">
                  {t.symbol}{" "}
                  <span className="font-mono text-xs text-white/30">({t.decimals} dp)</span>
                </dt>
                <dd>
                  <AddressChip address={t.address} />
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
