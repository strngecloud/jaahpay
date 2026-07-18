import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { serverAdminFetch, ServerApiError } from "@/lib/admin/server";

export const runtime = "nodejs";

const VALID_STATUSES = ["pending", "processing", "completed", "failed", "cancelled", "refunded"];

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

/** Map the server's camelCase entity to the snake_case shape the UI expects. */
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

  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  const type = params.get("type");
  const search = params.get("search")?.trim();
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "25", 10) || 25, 1), 100);
  const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status && VALID_STATUSES.includes(status)) query.set("status", status);
  if (type) query.set("type", type);
  if (search) query.set("search", search);

  try {
    const data = await serverAdminFetch<{
      transactions: ServerTx[];
      total: number;
    }>(`/transactions/admin?${query}`);

    return NextResponse.json({
      configured: true,
      transactions: (data.transactions || []).map(toRow),
      total: data.total ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    const status = error instanceof ServerApiError ? error.status : 500;
    return NextResponse.json(
      {
        configured: false,
        transactions: [],
        total: 0,
        error: error instanceof Error ? error.message : "Server unreachable",
      },
      { status: status === 401 ? 500 : status },
    );
  }
}
