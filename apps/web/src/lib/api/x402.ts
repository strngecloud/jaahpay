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

/** USD prices expressed in USDC atomic units (6 decimals) */
export const X402_PRICES = {
  /** $0.001 — raw data lookups (quotes, rates) */
  MICRO: "1000",
  /** $0.002 — computed recommendations */
  SMALL: "2000",
  /** $0.005 — conversational AI responses */
  MEDIUM: "5000",
  /** $0.05 — full premium market analysis */
  PREMIUM: "50000",
} as const;

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
    const payTo = process.env.NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS;
    if (!payTo) {
      return Response.json(
        { error: "Server configuration error: FEE_COLLECTOR_ADDRESS not set" },
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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
      body: facilitatorBody,
    });
    const settlement = await settleRes.json();
    if (!settlement.success) {
      return paymentRequired(
        resourceUrl,
        payTo,
        options.price,
        options.description,
        settlement.errorReason || "Payment settlement failed"
      );
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
