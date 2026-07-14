import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminSupabase } from "@/lib/admin/supabase-admin";

export const runtime = "nodejs";

const VALID_STATUSES = ["pending", "processing", "completed", "failed", "cancelled"];

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      configured: false,
      transactions: [],
      total: 0,
      error: "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / key missing).",
    });
  }

  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  const type = params.get("type");
  const search = params.get("search")?.trim();
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "25", 10) || 25, 1), 100);
  const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

  let query = supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && VALID_STATUSES.includes(status)) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (search) {
    query = query.or(
      `user_address.ilike.%${search}%,tx_hash.ilike.%${search}%,id.ilike.%${search}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json(
      { configured: true, transactions: [], total: 0, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    configured: true,
    transactions: data || [],
    total: count ?? data?.length ?? 0,
    limit,
    offset,
  });
}
