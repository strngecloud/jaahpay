"use client";

import React, { useState } from "react";
import {
  Bot,
  Zap,
  TrendingUp,
  MessageSquare,
  Sparkles,
  LineChart,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { ThirdwebProvider, useFetchWithPayment } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { cn } from "@/lib/utils";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
const thirdwebClient = clientId ? createThirdwebClient({ clientId }) : null;

interface PlaygroundService {
  id: string;
  name: string;
  description: string;
  priceUsd: string;
  icon: React.ReactNode;
  url: string;
  init?: RequestInit;
}

const SERVICES: PlaygroundService[] = [
  {
    id: "mento-quote",
    name: "Oracle Swap Quote",
    description: "Live Mento quote: 100 USDC → USDT at oracle rates",
    priceUsd: "$0.001",
    icon: <Zap className="w-4 h-4 text-brand-blue" />,
    url: "/api/providers/mento-quotes?from=USDC&to=USDT&amount=100",
  },
  {
    id: "rates",
    name: "Market Rates Snapshot",
    description: "Full live snapshot: rates, tradability, volatility index",
    priceUsd: "$0.001",
    icon: <LineChart className="w-4 h-4 text-brand-green" />,
    url: "/api/swap/rates",
  },
  {
    id: "recommendation",
    name: "AI Swap Recommendation",
    description: "Optimal slippage, timing and route for a 100 USDC swap",
    priceUsd: "$0.002",
    icon: <TrendingUp className="w-4 h-4 text-yellow-400" />,
    url: "/api/agent/recommendation?x402=pay",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: "100", fromToken: "USDC", chainId: 42220 }),
    },
  },
  {
    id: "chat",
    name: "Ask the Swap Agent",
    description: '"Should I swap 500 USDC to USDT now?"',
    priceUsd: "$0.005",
    icon: <MessageSquare className="w-4 h-4 text-purple-400" />,
    url: "/api/agent/chat?x402=pay",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Should I swap 500 USDC to USDT now?" }),
    },
  },
  {
    id: "premium",
    name: "Premium Market Analysis",
    description: "Pool health, sentiment, macro trends, confidence score",
    priceUsd: "$0.05",
    icon: <Sparkles className="w-4 h-4 text-pink-400" />,
    url: "/api/agent/premium-analysis",
  },
];

interface Receipt {
  transaction?: string;
  payer?: string;
}

function decodeReceipt(res: Response): Receipt | null {
  const header = res.headers.get("X-PAYMENT-RESPONSE");
  if (!header) return null;
  try {
    return JSON.parse(atob(header));
  } catch {
    return null;
  }
}

function ServiceCard({ service }: { service: PlaygroundService }) {
  const { fetchWithPayment, isPending } = useFetchWithPayment(thirdwebClient!, {
    parseAs: "raw",
  });
  const [result, setResult] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCall = async () => {
    setError(null);
    setResult(null);
    setReceipt(null);
    try {
      const res = (await fetchWithPayment(service.url, service.init)) as Response;
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || `Request failed (${res.status})`);
        return;
      }
      setResult(JSON.stringify(json, null, 2));
      setReceipt(decodeReceipt(res));
    } catch {
      setError("Payment cancelled or failed");
    }
  };

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#080d18]/80 backdrop-blur-2xl p-4 flex flex-col gap-3 transition-all duration-300 hover:border-white/[0.15] hover:shadow-[0_10px_40px_rgba(168,85,247,0.15)]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/30 flex items-center justify-center shrink-0">
          {service.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{service.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold">
              {service.priceUsd}
            </span>
          </div>
          <p className="text-[11px] text-white/40 mt-0.5 truncate">
            {service.description}
          </p>
        </div>
      </div>

      <button
        onClick={handleCall}
        disabled={isPending}
        className="w-full py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {isPending ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Paying &amp; fetching…
          </>
        ) : (
          <>Pay {service.priceUsd} &amp; call</>
        )}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="space-y-2">
          <pre className="text-[10px] text-white/60 bg-black/30 border border-white/[0.05] rounded-xl p-3 max-h-48 overflow-auto whitespace-pre-wrap break-all">
            {result}
          </pre>
          {receipt?.transaction && (
            <a
              href={`https://celoscan.io/tx/${receipt.transaction}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-brand-green hover:underline"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Payment settled on Celo — view transaction
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function PlaygroundInner() {
  return (
    <main className="min-h-screen bg-[#04070f] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold">
            <Bot className="w-3.5 h-3.5" />
            Jahpay Agent Services — x402 Playground
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Pay per request. Settled on Celo.
          </h1>
          <p className="text-sm text-white/50 max-w-xl mx-auto">
            Every button below makes a real x402 micropayment in USDC on Celo
            mainnet — signed by your wallet, settled by the Celo facilitator,
            answered by the Jahpay agent. Connect any wallet when prompted.
          </p>
        </header>

        {!thirdwebClient ? (
          <p className="text-center text-sm text-white/40">
            Playground unavailable: NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {SERVICES.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        )}

        <footer className="text-center space-y-2 pt-4">
          <p className="text-[11px] text-white/30">
            Agents can integrate directly — machine-readable menu at{" "}
            <a href="/api/agent/catalog" className="text-purple-400 hover:underline">
              /api/agent/catalog
            </a>{" "}
            and{" "}
            <a href="/.well-known/x402" className="text-purple-400 hover:underline">
              /.well-known/x402
            </a>
          </p>
          <a
            href="https://dune.com/celo/agentic-payments-defai-hackathon"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70"
          >
            Live hackathon leaderboard <ExternalLink className="w-3 h-3" />
          </a>
        </footer>
      </div>
    </main>
  );
}

export default function PlaygroundPage() {
  if (!thirdwebClient) {
    return <PlaygroundInner />;
  }
  return (
    <ThirdwebProvider>
      <PlaygroundInner />
    </ThirdwebProvider>
  );
}
