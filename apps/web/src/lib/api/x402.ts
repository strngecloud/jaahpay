import { NextRequest } from "next/server";

/**
 * Shared x402 payment middleware (Agent Payments Layer).
 *
 * Wraps an API route handler with an x402 paywall: requests without a valid
 * X-PAYMENT header receive a 402 with payment requirements; paid requests are
 * verified and settled on-chain through the Celo x402 facilitator, credited
 * to the Jahpay fee collector.
 *
 * Works in both edge and nodejs runtimes (web APIs only).
 */

const FACILITATOR_URL = "https://api.x402.celo.org";
const CELO_USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

/**
 * The facilitator's /settle endpoint requires an X-API-Key (self-serve at
 * x402.celo.org — see scripts/x402-keygen.ts). /verify works without one.
 */
function facilitatorHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = process.env.X402_FACILITATOR_API_KEY;
  if (apiKey) headers["X-API-Key"] = apiKey;
  return headers;
}

/**
 * USD prices expressed in USDC atomic units (6 decimals): "1000000" = $1.00,
 * "100" = $0.0001.
 *
 * Overridable from the environment so you can retune pricing WITHOUT a code
 * change: set X402_PRICE_ATOMIC to price every tier the same, or override one
 * tier with X402_PRICE_MICRO_ATOMIC / _SMALL_ / _MEDIUM_ / _PREMIUM_.
 * A per-tier value wins over X402_PRICE_ATOMIC, which wins over the default.
 *
 * These are read SERVER-SIDE, so for production jahpay.xyz to charge the new
 * price you must set the var in your Vercel project env (not just local .env)
 * and redeploy — local .env only affects `pnpm dev`.
 */
const priceAtomic = (tier: string, fallback: string): string => {
  const value = process.env[`X402_PRICE_${tier}_ATOMIC`] || process.env.X402_PRICE_ATOMIC || fallback;
  return /^\d+$/.test(value) ? value : fallback; // ignore malformed overrides
};

export const X402_PRICES = {
  /** raw data lookups (quotes, rates) — default $1.00 */
  MICRO: priceAtomic("MICRO", "1000000"),
  /** computed recommendations — default $1.00 */
  SMALL: priceAtomic("SMALL", "1000000"),
  /** conversational AI responses — default $1.00 */
  MEDIUM: priceAtomic("MEDIUM", "1000000"),
  /** full premium market analysis — default $1.00 */
  PREMIUM: priceAtomic("PREMIUM", "1000000"),
} as const;

/**
 * Wallet that receives x402 payments. X402_PAYTO_ADDRESS should be the wallet
 * registered on the Celo Builders allowlist so settlements are attributed on
 * the hackathon leaderboard (facilitator txs can't carry the ERC-8021 tag —
 * they're counted by payer/payee wallet instead). Falls back to the fee
 * collector for backwards compatibility.
 */
export function getX402PayTo(): string | undefined {
  return process.env.X402_PAYTO_ADDRESS || process.env.NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS;
}

export interface X402Options {
  /** Price in USDC atomic units (6 decimals), e.g. "1000" = $0.001 */
  price: string;
  /** Human/agent-readable description shown in payment requirements */
  description: string;
  /**
   * Allow unpaid requests from the app's own frontend (browser same-origin
   * calls). Direct/external clients must always pay.
   */
  allowSameOrigin?: boolean;
}

export function buildPaymentRequirements(
  resourceUrl: string,
  payTo: string,
  price: string,
  description: string
) {
  return {
    scheme: "exact",
    network: "celo",
    maxAmountRequired: price,
    resource: resourceUrl,
    description,
    mimeType: "application/json",
    payTo,
    maxTimeoutSeconds: 300,
    asset: CELO_USDC,
    extra: { name: "USDC", version: "2" },
  };
}

function paymentRequired(
  resourceUrl: string,
  payTo: string,
  price: string,
  description: string,
  error: string
) {
  return Response.json(
    {
      x402Version: 1,
      error,
      accepts: [buildPaymentRequirements(resourceUrl, payTo, price, description)],
    },
    { status: 402 }
  );
}

/** Browser requests from our own app carry sec-fetch-site: same-origin */
function isSameOriginBrowserRequest(req: NextRequest): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin") return true;
  // Fallback for browsers without fetch metadata: compare Origin/Referer host
  const source = req.headers.get("origin") || req.headers.get("referer");
  if (!source) return false;
  try {
    return new URL(source).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

/**
 * Wrap a route handler with the x402 paywall.
 *
 * Usage: export const GET = withRateLimit(withX402(handler, { price, description }))
 */
export function withX402(
  handler: (req: NextRequest) => Promise<Response>,
  options: X402Options
) {
  return async (req: NextRequest): Promise<Response> => {
    const payTo = getX402PayTo();
    if (!payTo) {
      return Response.json(
        { error: "Server configuration error: X402_PAYTO_ADDRESS not set" },
        { status: 500 }
      );
    }

    const resourceUrl = req.url;
    const paymentHeader =
      req.headers.get("X-PAYMENT") || req.headers.get("PAYMENT-SIGNATURE");

    // Same-origin free pass for the app's own UI — unless the caller is
    // already offering a payment or explicitly opted in via ?x402=pay
    // (used by the playground so its calls always settle on-chain).
    if (
      options.allowSameOrigin &&
      !paymentHeader &&
      !req.nextUrl.searchParams.has("x402") &&
      isSameOriginBrowserRequest(req)
    ) {
      return handler(req);
    }

    if (!paymentHeader) {
      return paymentRequired(
        resourceUrl,
        payTo,
        options.price,
        options.description,
        "X-PAYMENT header is required"
      );
    }

    let paymentPayload: unknown;
    try {
      paymentPayload = JSON.parse(atob(paymentHeader));
    } catch {
      return paymentRequired(
        resourceUrl,
        payTo,
        options.price,
        options.description,
        "Invalid X-PAYMENT header"
      );
    }

    const paymentRequirements = buildPaymentRequirements(
      resourceUrl,
      payTo,
      options.price,
      options.description
    );
    const facilitatorBody = JSON.stringify({
      x402Version: 1,
      paymentPayload,
      paymentRequirements,
    });

    const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: facilitatorHeaders(),
      body: facilitatorBody,
    });
    const verification = await verifyRes.json();
    if (!verification.isValid) {
      return paymentRequired(
        resourceUrl,
        payTo,
        options.price,
        options.description,
        verification.invalidReason || "Payment verification failed"
      );
    }

    // Run the handler first so a failing handler never charges the buyer
    const response = await handler(req);
    if (!response.ok) return response;

    const settleRes = await fetch(`${FACILITATOR_URL}/settle`, {
      method: "POST",
      headers: facilitatorHeaders(),
      body: facilitatorBody,
    });
    const settlement = await settleRes.json().catch(() => ({}));
    if (!settlement.success) {
      // Facilitator error shape varies (errorReason / error / invalidReason);
      // surface whatever it sent so clients can see the real failure.
      const reason =
        settlement.errorReason ||
        settlement.error ||
        settlement.invalidReason ||
        `Payment settlement failed (facilitator ${settleRes.status}: ${JSON.stringify(settlement)})`;
      return paymentRequired(resourceUrl, payTo, options.price, options.description, reason);
    }

    const headers = new Headers(response.headers);
    // x402 v1 receipt header so the client can read the settlement tx
    headers.set("X-PAYMENT-RESPONSE", btoa(JSON.stringify(settlement)));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
