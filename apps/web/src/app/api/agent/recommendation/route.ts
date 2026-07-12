import { NextRequest, NextResponse } from 'next/server';
import { computeRecommendation } from '@/lib/agent/agent-intelligence';
import { withRateLimit } from '@/lib/api/middleware';
import { withX402, X402_PRICES } from '@/lib/api/x402';

export const runtime = 'nodejs';

/**
 * AI Swap Recommendation API — uses live Mento quotes and tradability.
 */
async function handler(req: NextRequest) {
  try {
    const { amount, fromToken, chainId } = await req.json();
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const recommendation = await computeRecommendation(
      parsedAmount,
      fromToken ?? 'USDC',
      typeof chainId === 'number' ? chainId : 42220,
    );

    return NextResponse.json(recommendation, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute recommendation' },
      { status: 500 },
    );
  }
}

// x402-paid for external agents ($0.002/request); free for the Jahpay app itself
export const POST = withRateLimit(
  withX402(handler, {
    price: X402_PRICES.SMALL,
    description: 'Jahpay AI swap recommendation (slippage, timing, route)',
    allowSameOrigin: true,
  }),
  { limit: 30, window: 60000 },
);
