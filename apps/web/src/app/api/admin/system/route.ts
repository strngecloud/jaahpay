import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { publicClient, resolveFeeCollector } from "@/lib/admin/chain";
import { getAdminSupabase } from "@/lib/admin/supabase-admin";
import {
  JAHPAY_ROUTER_ADDRESS,
  ERC8004_CONTRACTS,
  UNISWAP_V3_CONTRACTS,
  SWAP_TOKENS,
  AGENT_CONFIG,
} from "@/lib/minipay/constants";

export const runtime = "nodejs";

async function checkRpc() {
  const started = Date.now();
  try {
    const blockNumber = await publicClient.getBlockNumber();
    return { ok: true, blockNumber: blockNumber.toString(), latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      blockNumber: null,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "RPC unreachable",
    };
  }
}

async function checkSpendServer() {
  const base = process.env.NEXT_PUBLIC_SPEND_API_URL;
  if (!base) return { ok: false, configured: false, error: "NEXT_PUBLIC_SPEND_API_URL not set" };
  const started = Date.now();
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    return { ok: res.ok, configured: true, status: res.status, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Unreachable",
    };
  }
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const [rpc, spendServer, feeCollector] = await Promise.all([
    checkRpc(),
    checkSpendServer(),
    resolveFeeCollector().catch(() => null),
  ]);

  return NextResponse.json({
    services: {
      rpc: { ...rpc, url: process.env.ARB_RPC_URL || "https://forno.celo.org" },
      spendServer: { ...spendServer, url: process.env.NEXT_PUBLIC_SPEND_API_URL || null },
      supabase: {
        ok: !!getAdminSupabase(),
        configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceRole: !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
      sentry: {
        configured: !!(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN),
        enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true",
      },
    },
    agent: {
      id: AGENT_CONFIG.agentId,
      registered: !!AGENT_CONFIG.agentId,
      chainId: AGENT_CONFIG.chainId,
    },
    contracts: {
      jahpaySwapRouter: JAHPAY_ROUTER_ADDRESS,
      feeCollector,
      uniswapSwapRouter: UNISWAP_V3_CONTRACTS.SWAP_ROUTER,
      uniswapQuoterV2: UNISWAP_V3_CONTRACTS.QUOTER_V2,
      erc8004IdentityRegistry: ERC8004_CONTRACTS.identityRegistry,
      erc8004ReputationRegistry: ERC8004_CONTRACTS.reputationRegistry,
      erc8004ValidationRegistry: ERC8004_CONTRACTS.validationRegistry,
    },
    tokens: SWAP_TOKENS.map((t) => ({
      symbol: t.symbol,
      address: t.address,
      decimals: t.decimals,
    })),
    env: process.env.NEXT_PUBLIC_APP_ENV || "development",
  });
}
