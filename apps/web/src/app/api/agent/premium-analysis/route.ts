export const runtime = "edge";

/**
 * Premium AI Market Analysis Endpoint
 * Gated by x402 (Agent Payments Layer)
 * Requires a $0.05 USDC payment on Celo mainnet to access.
 *
 * Payments are verified and settled through the Celo x402 facilitator
 * (https://api.x402.celo.org) so each pay-per-request payment lands
 * on-chain on Celo, credited to the Jahpay fee collector (payTo).
 */

const FACILITATOR_URL = "https://api.x402.celo.org";
const CELO_USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
/** $0.05 in USDC atomic units (6 decimals) */
const PRICE_ATOMIC = "50000";

function buildPaymentRequirements(resourceUrl: string, payTo: string) {
  return {
    scheme: "exact",
    network: "celo",
    maxAmountRequired: PRICE_ATOMIC,
    resource: resourceUrl,
    description: "Jahpay Premium AI Market Analysis",
    mimeType: "application/json",
    payTo,
    maxTimeoutSeconds: 300,
    asset: CELO_USDC,
    extra: { name: "USDC", version: "2" },
  };
}

function paymentRequired(resourceUrl: string, payTo: string, error: string) {
  return Response.json(
    {
      x402Version: 1,
      error,
      accepts: [buildPaymentRequirements(resourceUrl, payTo)],
    },
    { status: 402 }
  );
}

export async function GET(request: Request) {
  const payTo = process.env.NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS;
  if (!payTo) {
    return Response.json(
      { error: "Server configuration error: FEE_COLLECTOR_ADDRESS not set" },
      { status: 500 }
    );
  }

  const resourceUrl = request.url;
  const paymentHeader =
    request.headers.get("X-PAYMENT") || request.headers.get("PAYMENT-SIGNATURE");

  if (!paymentHeader) {
    return paymentRequired(resourceUrl, payTo, "X-PAYMENT header is required");
  }

  // Decode the base64 payment payload signed by the buyer
  let paymentPayload: unknown;
  try {
    paymentPayload = JSON.parse(atob(paymentHeader));
  } catch {
    return paymentRequired(resourceUrl, payTo, "Invalid X-PAYMENT header");
  }

  const paymentRequirements = buildPaymentRequirements(resourceUrl, payTo);
  const facilitatorBody = JSON.stringify({
    x402Version: 1,
    paymentPayload,
    paymentRequirements,
  });

  // Verify the payment signature with the Celo facilitator
  const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: facilitatorBody,
  });
  const verification = await verifyRes.json();
  if (!verification.isValid) {
    return paymentRequired(
      resourceUrl,
      payTo,
      verification.invalidReason || "Payment verification failed"
    );
  }

  // Settle the payment on-chain (facilitator submits the EIP-3009 transfer)
  const settleRes = await fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: facilitatorBody,
  });
  const settlement = await settleRes.json();
  if (!settlement.success) {
    return paymentRequired(
      resourceUrl,
      payTo,
      settlement.errorReason || "Payment settlement failed"
    );
  }

  const analysis = await generatePremiumAnalysis();
  return Response.json(
    { data: analysis },
    {
      headers: {
        // x402 v1 receipt header so the client can read the settlement tx
        "X-PAYMENT-RESPONSE": btoa(JSON.stringify(settlement)),
      },
    }
  );
}

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
