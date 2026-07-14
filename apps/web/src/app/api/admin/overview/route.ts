import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminSupabase } from "@/lib/admin/supabase-admin";
import { getFeeCollectorReport, publicClient } from "@/lib/admin/chain";

export const runtime = "nodejs";

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

const DAYS = 30;

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = getAdminSupabase();

  const [dbResult, feeReport, blockNumber] = await Promise.all([
    supabase
      ? supabase
          .from("transactions")
          .select(
            "id, user_address, type, status, from_token, to_token, from_amount, to_amount, platform_fee, tx_hash, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(2000)
      : Promise.resolve(null),
    getFeeCollectorReport().catch(() => ({ feeCollector: null, owner: null, tokens: [] })),
    publicClient.getBlockNumber().catch(() => null),
  ]);

  const rows: TxRow[] = (dbResult?.data as TxRow[] | null) || [];
  const dbError = dbResult?.error?.message || null;

  const num = (v: string | undefined) => {
    const n = parseFloat(v || "0");
    return Number.isFinite(n) ? n : 0;
  };

  const completed = rows.filter((r) => r.status === "completed");
  const totalVolume = completed.reduce((sum, r) => sum + num(r.to_amount), 0);
  const totalFees = completed.reduce((sum, r) => sum + num(r.platform_fee), 0);
  const uniqueWallets = new Set(rows.map((r) => r.user_address?.toLowerCase()).filter(Boolean))
    .size;

  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const last24h = rows.filter((r) => now - new Date(r.created_at).getTime() < dayMs);

  // Daily volume for the last 30 days (completed swaps, USD-equivalent amounts)
  const daily: { date: string; volume: number; count: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const dayStart = new Date(now - i * dayMs).toISOString().slice(0, 10);
    daily.push({ date: dayStart, volume: 0, count: 0 });
  }
  const dailyByDate = new Map(daily.map((d) => [d.date, d]));
  for (const r of completed) {
    const bucket = dailyByDate.get(r.created_at.slice(0, 10));
    if (bucket) {
      bucket.volume += num(r.to_amount);
      bucket.count += 1;
    }
  }

  return NextResponse.json({
    database: {
      configured: !!supabase,
      error: dbError,
      sampled: rows.length,
    },
    kpis: {
      totalTransactions: rows.length,
      completed: completed.length,
      failed: rows.filter((r) => r.status === "failed").length,
      pending: rows.filter((r) => r.status === "pending" || r.status === "processing").length,
      successRate: rows.length ? (completed.length / rows.length) * 100 : null,
      totalVolume,
      totalFees,
      uniqueWallets,
      txLast24h: last24h.length,
      volumeLast24h: last24h
        .filter((r) => r.status === "completed")
        .reduce((sum, r) => sum + num(r.to_amount), 0),
    },
    daily,
    recent: rows.slice(0, 8),
    chain: {
      blockNumber: blockNumber?.toString() || null,
      feeCollector: feeReport.feeCollector,
      feeBalances: feeReport.tokens,
    },
  });
}
