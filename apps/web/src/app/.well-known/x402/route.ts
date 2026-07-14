import { NextResponse } from 'next/server';
import { getX402PayTo, X402_PRICES } from '@/lib/api/x402';

export const runtime = 'edge';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://jahpay.xyz';

/**
 * x402 discovery document at /.well-known/x402.
 * Lists every pay-per-request resource this origin sells so x402 crawlers
 * and agent marketplaces can index them.
 */
export async function GET() {
  const discovery = {
    x402Version: 1,
    network: 'celo',
    facilitator: 'https://api.x402.celo.org',
    payTo: getX402PayTo(),
    asset: {
      address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
      symbol: 'USDC',
      decimals: 6,
    },
    resources: [
      {
        resource: `${BASE_URL}/api/providers/mento-quotes`,
        method: 'GET',
        maxAmountRequired: X402_PRICES.MICRO,
        description: 'Oracle-priced Mento swap quote for a token pair and amount',
      },
      {
        resource: `${BASE_URL}/api/swap/rates`,
        method: 'GET',
        maxAmountRequired: X402_PRICES.MICRO,
        description: 'Live market snapshot: rates, tradability, volatility index',
      },
      {
        resource: `${BASE_URL}/api/agent/recommendation`,
        method: 'POST',
        maxAmountRequired: X402_PRICES.SMALL,
        description: 'AI swap recommendation: optimal slippage, timing, and route',
      },
      {
        resource: `${BASE_URL}/api/agent/chat`,
        method: 'POST',
        maxAmountRequired: X402_PRICES.MEDIUM,
        description: 'Conversational access to the Jahpay swap agent',
      },
      {
        resource: `${BASE_URL}/api/agent/premium-analysis`,
        method: 'GET',
        maxAmountRequired: X402_PRICES.PREMIUM,
        description: 'Premium AI market analysis: pool health, sentiment, macro trends',
      },
    ],
    catalog: `${BASE_URL}/api/agent/catalog`,
  };

  return NextResponse.json(discovery, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
