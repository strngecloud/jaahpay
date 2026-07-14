"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import {
  AddressChip,
  Callout,
  fetchAdmin,
  LoadingBlock,
  OkPill,
  SectionCard,
  StatCard,
} from "@/components/admin/ui";
import { ERC8004_CONTRACTS, AGENT_CONFIG } from "@/lib/minipay/constants";

interface Reputation {
  agentId: string | null;
  averageScore: number | null;
  totalFeedback: number;
  successRate: number | null;
  isRegistered: boolean;
  source?: string;
  message?: string;
}

export default function AdminAgentPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-agent-reputation"],
    queryFn: () => fetchAdmin<Reputation>("/api/agent/reputation"),
    refetchInterval: 120_000,
  });

  if (isLoading) return <LoadingBlock label="Reading agent reputation…" />;
  if (error || !data) {
    return <Callout tone="error">{(error as Error)?.message || "Failed to load agent data"}</Callout>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Agent</h1>
          <p className="mt-1 text-sm text-white/50">
            {AGENT_CONFIG.name} — ERC-8004 identity, on-chain reputation, and endpoints.
          </p>
        </div>
        <OkPill ok={data.isRegistered} labels={["registered", "not registered"]} />
      </header>

      {!data.isRegistered && (
        <Callout tone="warning">
          The agent isn&apos;t registered on-chain yet. Run{" "}
          <code className="font-mono">pnpm agent:deploy</code> and set NEXT_PUBLIC_AGENT_ID.
        </Callout>
      )}
      {data.source === "pending" && data.message && <Callout tone="info">{data.message}</Callout>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Agent ID"
          value={data.agentId ?? "—"}
          sub={`Chain ${AGENT_CONFIG.chainId}`}
          accent="purple"
        />
        <StatCard
          label="Average score"
          value={data.averageScore === null ? "—" : data.averageScore.toFixed(1)}
          sub="Out of 100, from user feedback"
        />
        <StatCard label="Feedback received" value={data.totalFeedback.toLocaleString()} />
        <StatCard
          label="Success rate"
          value={data.successRate === null ? "—" : `${data.successRate.toFixed(1)}%`}
          sub={data.source === "on-chain" ? "Read from ReputationRegistry" : "Awaiting feedback"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="ERC-8004 registries (Celo Mainnet)">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/50">Identity Registry</dt>
              <dd>
                <AddressChip address={ERC8004_CONTRACTS.identityRegistry} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/50">Reputation Registry</dt>
              <dd>
                <AddressChip address={ERC8004_CONTRACTS.reputationRegistry} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/50">Validation Registry</dt>
              <dd>
                <AddressChip address={ERC8004_CONTRACTS.validationRegistry || null} />
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Agent endpoints">
          <ul className="space-y-2 text-sm">
            {[
              { label: "Manifest", href: "/api/agent/manifest" },
              { label: "Agent card (.well-known)", href: "/.well-known/agent.json" },
              { label: "Reputation", href: "/api/agent/reputation" },
              { label: "Service catalog (x402)", href: "/api/agent/catalog" },
            ].map((e) => (
              <li key={e.href}>
                <a
                  href={e.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 transition-colors hover:border-brand-blue/30"
                >
                  <span className="text-white/70 group-hover:text-white">{e.label}</span>
                  <span className="flex items-center gap-2 font-mono text-xs text-white/40">
                    {e.href}
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
