import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getFeeCollectorReport } from "@/lib/admin/chain";
import { JAHPAY_ROUTER_ADDRESS, PLATFORM_FEE_BPS } from "@/lib/minipay/constants";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const report = await getFeeCollectorReport();
    return NextResponse.json({
      router: JAHPAY_ROUTER_ADDRESS,
      feeBps: PLATFORM_FEE_BPS,
      ...report,
    });
  } catch (error) {
    return NextResponse.json(
      {
        router: JAHPAY_ROUTER_ADDRESS,
        feeBps: PLATFORM_FEE_BPS,
        feeCollector: null,
        owner: null,
        tokens: [],
        error: error instanceof Error ? error.message : "Failed to read FeeCollector",
      },
      { status: 500 },
    );
  }
}
