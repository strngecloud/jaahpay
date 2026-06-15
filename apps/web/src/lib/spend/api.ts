import type {
  AccountValidation,
  Bank,
  ExchangeRateResponse,
  InitiateSpendRequest,
  InitiateSpendResponse,
  SpendHistoryItem,
  SpendStatusResponse,
} from "./types";

const SPEND_API_URL =
  process.env.NEXT_PUBLIC_SPEND_API_URL || "http://localhost:3001/api/v1";

async function spendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SPEND_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function fetchBanks(): Promise<Bank[]> {
  const res = await spendFetch<{ success: boolean; data: Bank[] }>("/banks");
  return res.data;
}

export async function validateAccount(
  accountNumber: string,
  bankCode: string,
): Promise<AccountValidation> {
  return spendFetch<AccountValidation>("/spend/validate-account", {
    method: "POST",
    body: JSON.stringify({ accountNumber, bankCode }),
  });
}

export async function fetchSpendHistory(
  userAddress: string,
  page = 1,
  limit = 20,
): Promise<{ spends: SpendHistoryItem[]; total: number }> {
  const params = new URLSearchParams({
    userAddress,
    page: String(page),
    limit: String(limit),
  });
  return spendFetch(`/spend?${params}`);
}

// ── New API functions for the spend flow ──────────────────────────────

/**
 * Fetch the current USD → NGN exchange rate
 */
export async function fetchExchangeRate(): Promise<ExchangeRateResponse> {
  return spendFetch<ExchangeRateResponse>("/rates/current");
}

/**
 * Initiate a spend (off-ramp) transaction on the server.
 * This validates, creates the spend record, and returns
 * the USDC quote for the frontend to execute on-chain.
 */
export async function initiateSpend(
  params: InitiateSpendRequest,
): Promise<InitiateSpendResponse> {
  return spendFetch<InitiateSpendResponse>("/spend/initiate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Get the current status of a spend transaction
 */
export async function getSpendStatus(
  spendId: string,
): Promise<SpendStatusResponse> {
  return spendFetch<SpendStatusResponse>(`/spend/${spendId}`);
}

/**
 * Cancel a pending spend transaction
 */
export async function cancelSpend(
  spendId: string,
  userAddress: string,
): Promise<SpendStatusResponse> {
  return spendFetch<SpendStatusResponse>(`/spend/cancel/${spendId}`, {
    method: "POST",
    body: JSON.stringify({ userAddress }),
  });
}

/**
 * Confirm the blockchain transaction for a spend.
 * Called after the on-chain tx succeeds to link the
 * server record with the blockchain transaction.
 */
export async function confirmBlockchainSpend(
  tempSpendId: string,
  blockchainTxHash: string,
  blockchainSpendId: string,
): Promise<{ success: boolean }> {
  return spendFetch<{ success: boolean }>("/spend/confirm-blockchain", {
    method: "POST",
    body: JSON.stringify({ tempSpendId, blockchainTxHash, blockchainSpendId }),
  });
}
