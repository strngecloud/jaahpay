import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Admin session management.
 *
 * Access is gated by a wallet allowlist (ADMIN_WALLET_ADDRESSES, comma
 * separated, server-side only). A successful signature check mints an
 * HMAC-signed session cookie so subsequent admin API calls don't need a
 * fresh signature. ADMIN_SESSION_SECRET signs the cookie.
 */

export const ADMIN_COOKIE = "jahpay_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function getAdminAddresses(): string[] {
  return (process.env.ADMIN_WALLET_ADDRESSES || "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^0x[a-f0-9]{40}$/.test(a));
}

export function isAdminAddress(address: string): boolean {
  return getAdminAddresses().includes(address.toLowerCase());
}

export function isAdminConfigured(): boolean {
  return getAdminAddresses().length > 0 && !!process.env.ADMIN_SESSION_SECRET;
}

function sign(payload: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET not set");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(address: string): string {
  const payload = Buffer.from(
    JSON.stringify({ address: address.toLowerCase(), exp: Date.now() + SESSION_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token || !process.env.ADMIN_SESSION_SECRET) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let expected: Buffer;
  try {
    expected = Buffer.from(sign(payload));
  } catch {
    return null;
  }
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const { address, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof address !== "string" || typeof exp !== "number") return null;
    if (Date.now() > exp) return null;
    // Re-check the allowlist so revoking an address kills live sessions
    if (!isAdminAddress(address)) return null;
    return address;
  } catch {
    return null;
  }
}

/** Returns the admin address, or a NextResponse error to return as-is. */
export function requireAdmin(req: NextRequest): string | NextResponse {
  const address = verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!address) {
    return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  }
  return address;
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
