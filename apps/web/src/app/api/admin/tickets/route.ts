import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { serverAdminFetch, ServerApiError } from "@/lib/admin/server";

export const runtime = "nodejs";

const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"];

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  const search = params.get("search")?.trim();
  const page = Math.max(parseInt(params.get("page") || "1", 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "25", 10) || 25, 1), 100);

  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status && VALID_STATUSES.includes(status)) query.set("status", status);
  if (search) query.set("search", search);

  try {
    const data = await serverAdminFetch<{
      tickets: unknown[];
      total: number;
      page: number;
      limit: number;
      openCount: number;
    }>(`/support/admin/tickets?${query}`);
    return NextResponse.json({ configured: true, ...data });
  } catch (error) {
    const status = error instanceof ServerApiError ? error.status : 500;
    return NextResponse.json(
      {
        configured: false,
        tickets: [],
        total: 0,
        openCount: 0,
        error: error instanceof Error ? error.message : "Server unreachable",
      },
      { status: status === 401 ? 500 : status },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const { ticketRef, status, resolutionNotes } = body as {
    ticketRef?: string;
    status?: string;
    resolutionNotes?: string;
  };

  if (!ticketRef) {
    return NextResponse.json({ error: "ticketRef is required" }, { status: 400 });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const data = await serverAdminFetch(
      `/support/admin/tickets/${encodeURIComponent(ticketRef)}`,
      { method: "PATCH", body: JSON.stringify({ status, resolutionNotes }) },
    );
    return NextResponse.json({ success: true, ticket: data });
  } catch (error) {
    const s = error instanceof ServerApiError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: s === 401 ? 500 : s },
    );
  }
}
