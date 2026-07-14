import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { verifyNonce } from "@/lib/auth/nonce-utils";
import {
  ADMIN_COOKIE,
  clearSessionCookie,
  createSessionToken,
  isAdminAddress,
  isAdminConfigured,
  setSessionCookie,
  verifySessionToken,
} from "@/lib/admin/auth";

export const runtime = "nodejs";

/** Current admin session status. */
export async function GET(req: NextRequest) {
  const address = verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  return NextResponse.json({
    authenticated: !!address,
    address,
    configured: isAdminConfigured(),
  });
}

/**
 * Sign in as admin: verify a wallet signature over the nonce message
 * (issued by /api/auth/nonce) and check the address against the allowlist.
 */
export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "Admin access is not configured. Set ADMIN_WALLET_ADDRESSES and ADMIN_SESSION_SECRET on the server.",
      },
      { status: 503 },
    );
  }

  const { address, message, signature, nonce } = await req.json().catch(() => ({}));
  if (!address || !message || !signature || !nonce) {
    return NextResponse.json(
      { error: "Missing address, message, signature, or nonce" },
      { status: 400 },
    );
  }

  if (!isAdminAddress(address)) {
    return NextResponse.json({ error: "This wallet is not an admin" }, { status: 403 });
  }

  // The signature must be over the freshly issued nonce message — a stale or
  // foreign signature from the same wallet must not mint an admin session.
  if (typeof message !== "string" || !message.includes(`Nonce: ${nonce}`)) {
    return NextResponse.json({ error: "Message does not match the issued nonce" }, { status: 401 });
  }
  if (!verifyNonce(address, nonce)) {
    return NextResponse.json({ error: "Nonce expired — request a new one" }, { status: 401 });
  }

  let valid = false;
  try {
    valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  const res = NextResponse.json({ authenticated: true, address: address.toLowerCase() });
  setSessionCookie(res, createSessionToken(address));
  return res;
}

/** Sign out. */
export async function DELETE() {
  const res = NextResponse.json({ authenticated: false });
  clearSessionCookie(res);
  return res;
}
