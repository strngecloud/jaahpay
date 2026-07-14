import { NextResponse } from 'next/server';
import { X402_PRICES } from '@/lib/api/x402';

export const runtime = 'edge';

/**
 * Free discovery endpoint: the menu of Jahpay's x402-paid services.
 * Agents fetch this to learn what they can buy, then pay per request
 * via the x402 protocol (Celo mainnet, USDC).
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jahpay.xyz';

  const catalog = {
    name: 'Jahpay Agent Services',
    description:
      'Pay-per-request market data and AI services for Celo stablecoin swaps. All endpoints accept x402 payments (USDC on Celo mainnet) settled through the Celo facilitator.',
    x402: {
      version: 1,
      network: 'celo',
      facilitator: 'https://api.x402.celo.org',
      asset: 'USDC',
    },
    services: [
      {
        endpoint: `${baseUrl}/api/providers/mento-quotes`,
        method: 'GET',
        priceUsd: Number(X402_PRICES.MICRO) / 1e6,
        priceAtomic: X402_PRICES.MICRO,
        description: 'Oracle-priced Mento swap quote for a token pair and amount',
        params: { from: 'USDC', to: 'USDT', amount: '100' },
      },
      {
        endpoint: `${baseUrl}/api/swap/rates`,
        method: 'GET',
        priceUsd: Number(X402_PRICES.MICRO) / 1e6,
        priceAtomic: X402_PRICES.MICRO,
        description: 'Full live market snapshot: rates, tradability, volatility index',
      },
      {
        endpoint: `${baseUrl}/api/agent/recommendation`,
        method: 'POST',
        priceUsd: Number(X402_PRICES.SMALL) / 1e6,
        priceAtomic: X402_PRICES.SMALL,
        description: 'AI swap recommendation: optimal slippage, timing, and route',
        body: { amount: '100', fromToken: 'USDC', chainId: 42220 },
      },
      {
        endpoint: `${baseUrl}/api/agent/chat`,
        method: 'POST',
        priceUsd: Number(X402_PRICES.MEDIUM) / 1e6,
        priceAtomic: X402_PRICES.MEDIUM,
        description: 'Conversational access to the Jahpay swap agent with live market context',
        body: { message: 'Should I swap 500 USDC to USDT now?' },
      },
      {
        endpoint: `${baseUrl}/api/agent/premium-analysis`,
        method: 'GET',
        priceUsd: Number(X402_PRICES.PREMIUM) / 1e6,
        priceAtomic: X402_PRICES.PREMIUM,
        description: 'Premium AI market analysis: pool health, sentiment, macro trends',
      },
    ],
  };

  return NextResponse.json(catalog, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
