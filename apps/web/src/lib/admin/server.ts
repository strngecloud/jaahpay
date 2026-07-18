/**
 * Server-side client for the NestJS admin API.
 *
 * These helpers run only inside admin API routes (already gated by the admin
 * session cookie via requireAdmin). They authenticate to the server's guarded
 * admin endpoints with ADMIN_API_KEY, which must match the server's env and is
 * never exposed to the browser.
 */

const SERVER_API_URL =
  process.env.NEXT_PUBLIC_SPEND_API_URL || "http://localhost:3001/api/v1";

export function isServerConfigured(): boolean {
  return !!SERVER_API_URL;
}

export class ServerApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** GET a guarded admin endpoint on the NestJS server. Returns parsed JSON. */
export async function serverAdminFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${SERVER_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ADMIN_API_KEY || "",
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ServerApiError(
      body.message || `Server request failed (${res.status})`,
      res.status,
    );
  }
  return res.json();
}
