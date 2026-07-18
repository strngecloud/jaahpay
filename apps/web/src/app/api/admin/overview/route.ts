import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { serverAdminFetch } from "@/lib/admin/server";
import { getFeeCollectorReport, publicClient } from "@/lib/admin/chain";

export const runtime = "nodejs";

interface ServerTx {
  id: string;
  userAddress?: string | null;
  type: string;
  status: string;
  fromToken?: string | null;
  toToken?: string | null;
  fromAmount?: string | null;
  toAmount?: string | null;
  platformFee?: string | null;
  txHash?: string | null;
  createdAt: string;
}

interface ServerStats {
  sampled: number;
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
  daily: { date: string; volume: number; count: number }[];
  recent: ServerTx[];
}

function toRow(t: ServerTx) {
  return {
    id: t.id,
    user_address: t.userAddress ?? undefined,
    type: t.type,
    status: t.status,
    from_token: t.fromToken ?? undefined,
    to_token: t.toToken ?? undefined,
    from_amount: t.fromAmount ?? "",
    to_amount: t.toAmount ?? "",
    platform_fee: t.platformFee ?? undefined,
    tx_hash: t.txHash ?? undefined,
    created_at: t.createdAt,
  };
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const [statsResult, ticketsResult, feeReport, blockNumber] = await Promise.all([
    serverAdminFetch<ServerStats>("/transactions/admin/stats").catch(
      (e) => ({ error: e instanceof Error ? e.message : "unreachable" }) as { error: string },
    ),
    serverAdminFetch<{ total: number; openCount: number }>(
      "/support/admin/tickets?limit=1",
    ).catch(() => null),
    getFeeCollectorReport().catch(() => ({ feeCollector: null, owner: null, tokens: [] })),
    publicClient.getBlockNumber().catch(() => null),
  ]);

  const stats = "error" in statsResult ? null : statsResult;
  const dbError = "error" in statsResult ? statsResult.error : null;

  return NextResponse.json({
    database: {
      configured: !!stats,
      error: dbError,
      sampled: stats?.sampled ?? 0,
    },
    kpis: {
      totalTransactions: stats?.totalTransactions ?? 0,
      completed: stats?.completed ?? 0,
      failed: stats?.failed ?? 0,
      pending: stats?.pending ?? 0,
      successRate: stats?.successRate ?? null,
      totalVolume: stats?.totalVolume ?? 0,
      totalFees: stats?.totalFees ?? 0,
      uniqueWallets: stats?.uniqueWallets ?? 0,
      txLast24h: stats?.txLast24h ?? 0,
      volumeLast24h: stats?.volumeLast24h ?? 0,
      openTickets: ticketsResult?.openCount ?? 0,
      totalTickets: ticketsResult?.total ?? 0,
    },
    daily: stats?.daily ?? [],
    recent: (stats?.recent ?? []).map(toRow).slice(0, 8),
    chain: {
      blockNumber: blockNumber?.toString() || null,
      feeCollector: feeReport.feeCollector,
      feeBalances: feeReport.tokens,
    },
  });
}
