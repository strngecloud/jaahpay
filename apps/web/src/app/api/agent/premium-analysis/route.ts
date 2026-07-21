import { NextRequest } from "next/server";
import { withX402, X402_PRICES } from "@/lib/api/x402";

export const runtime = "edge";

/**
 * Premium AI Market Analysis Endpoint
 * Gated by x402 (Agent Payments Layer)
 * Requires a $0.05 USDC payment on Celo mainnet, verified and settled
 * through the Celo x402 facilitator.
 */

async function handler() {
  const analysis = await generatePremiumAnalysis();
  return Response.json({ data: analysis });
}

export const GET = withX402(handler, {
  price: X402_PRICES.PREMIUM,
  description: "Jahpay Premium AI Market Analysis",
});

async function generatePremiumAnalysis() {
  const { getMarketSnapshot } = await import('@/lib/agent/agent-intelligence');
  const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '42220', 10);
  const snapshot = await getMarketSnapshot(chainId);

  const usdcUsdt = snapshot.pairs.find((p) => p.from === 'USDC' && p.to === 'USDT');
  const tradable = usdcUsdt?.tradable ?? true;
  const rate = usdcUsdt?.quote.rate ?? 1;
  const deviation = Math.abs(1 - rate);

  return {
    timestamp: snapshot.timestamp,
    overallSentiment: deviation < 0.002 ? 'stable' : deviation < 0.005 ? 'neutral' : 'cautious',
    volatilityIndex: snapshot.volatilityIndex,
    usdcUsdtPoolHealth: {
      liquidityDepth: tradable ? 'optimal' : 'restricted',
      imbalanceWarning: !tradable || deviation > 0.005,
      recommendedAction: tradable
        ? deviation > 0.005
          ? 'Use 0.5–1% slippage for large swaps'
          : 'Execute swaps with minimal slippage (0.1%)'
        : 'Wait — Mento circuit breaker may be active',
      liveRate: rate,
      platformFeePercent: 0.3,
    },
    macroTrends: [
      `Live Mento rate: 1 USDC = ${rate.toFixed(6)} USDT (deviation ${(deviation * 100).toFixed(4)}%).`,
      tradable
        ? 'USDC↔USDT pair is tradable on Mento Protocol.'
        : 'USDC↔USDT pair may be paused — check circuit breaker status.',
      snapshot.celoRate
        ? `CELO/USDC reference: 1 CELO ≈ ${snapshot.celoRate.rate.toFixed(4)} USDC via Mento.`
        : 'CELO swaps: use Ubeswap or Uniswap on Celo for native CELO liquidity.',
    ],
    agentConfidenceScore: tradable && deviation < 0.003 ? 96 : tradable ? 82 : 55,
    disclaimer: 'Analysis uses live Mento oracle data. Not financial advice.',
  };
}
