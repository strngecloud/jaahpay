import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";

/**
 * Arb-bot status: parses the trade log the bot appends to
 * (apps/web/.arb-bot/trades.jsonl) plus its env configuration.
 * Secrets are reported as booleans only.
 */
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const logPath = path.join(process.cwd(), ".arb-bot", "trades.jsonl");

  let trades: Record<string, unknown>[] = [];
  let logExists = false;
  try {
    if (fs.existsSync(logPath)) {
      logExists = true;
      trades = fs
        .readFileSync(logPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as Record<string, unknown>;
          } catch {
            return null;
          }
        })
        .filter((t): t is Record<string, unknown> => t !== null);
    }
  } catch {
    // unreadable log: report as absent
  }

  const num = (v: unknown) => {
    const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? n : 0;
  };

  const totals = { pnl: 0, volume: 0 };
  for (const t of trades) {
    totals.pnl += num(t.physicalPnl ?? t.pnl);
    totals.volume += num(t.amountIn ?? t.volume ?? t.tradeSize);
  }

  return NextResponse.json({
    arbBot: {
      logExists,
      totalTrades: trades.length,
      totalPnl: totals.pnl,
      totalVolume: totals.volume,
      lastTrades: trades.slice(-20).reverse(),
      config: {
        executeMode: process.env.ARB_EXECUTE === "1",
        walletConfigured: !!(process.env.ARB_BOT_PRIVATE_KEY || process.env.PRIVATE_KEY),
        tradeSize: process.env.ARB_TRADE_SIZE || "50",
        minTradeSize: process.env.ARB_MIN_TRADE_SIZE || "5",
        minEdgeBps: process.env.ARB_MIN_EDGE_BPS || "5",
        slippageBps: process.env.ARB_SLIPPAGE_BPS || "10",
        pollMs: process.env.ARB_POLL_MS || "20000",
        gasUsdPerLeg: process.env.ARB_GAS_USD_PER_LEG || "0.01",
        countPlatformFeeAsCost: process.env.ARB_COUNT_PLATFORM_FEE_AS_COST !== "false",
        rpcUrl: process.env.ARB_RPC_URL || "https://forno.celo.org",
      },
    },
    sweep: {
      ownerKeyConfigured: !!process.env.PRIVATE_KEY,
      sweepTo: process.env.SWEEP_TO || null,
    },
  });
}
