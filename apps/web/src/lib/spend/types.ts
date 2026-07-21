export interface Bank {
  code: string;
  name: string;
  slug?: string;
  logo?: string;
}

export interface AccountValidation {
  accountNumber: string;
  bankCode: string;
  accountName?: string;
  valid: boolean;
}

export interface SpendRecipient {
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
}

export interface SpendHistoryItem {
  spendId: string;
  status: string;
  ngnAmount: number;
  recipient?: {
    accountName: string;
    accountNumber: string;
    bank: string;
  };
  createdAt: string;
  // The server's history endpoint returns the full spend DTO (same shape as
  // SpendStatusResponse), so these are populated in practice — kept optional
  // for consumers that only need the summary fields above.
  usdcAmount?: number;
  exchangeRate?: number;
  platformFee?: number;
  bankReference?: string;
  transactionHash?: string;
  narration?: string;
  chain?: string;
  completedAt?: string;
  errorMessage?: string;
}

export type SpendStep = "recipient" | "confirm";

export type RecipientListTab = "recents" | "favourites";

// ── Extended flow types ───────────────────────────────────────────────

export type SpendFlowStep =
  | "recipient"
  | "confirm"
  | "amount"
  | "review"
  | "processing"
  | "complete"
  | "error";

export interface ExchangeRateResponse {
  usdToNgn: number;
  lastUpdated: string;
  sources: string[];
  confidence: number;
}

export interface InitiateSpendRequest {
  userAddress: string;
  ngnAmount: number;
  recipientAccountNumber: string;
  recipientBankCode: string;
  narration?: string;
  chain: "celo" | "base";
}

export interface InitiateSpendResponse {
  success: boolean;
  data: {
    spendId: string;
    usdcAmount: number;
    exchangeRate: number;
    platformFee: number;
    totalUSDCRequired: number;
    recipientAccountName: string;
    estimatedCompletionTime: string;
  };
}

export interface SpendStatusResponse {
  spendId: string;
  status: "pending" | "processing" | "completed" | "refunded" | "failed" | "cancelled";
  usdcAmount: number;
  ngnAmount: number;
  exchangeRate: number;
  platformFee: number;
  recipient?: {
    accountName: string;
    accountNumber: string;
    bank: string;
  };
  bankReference?: string;
  transactionHash?: string;
  narration?: string;
  chain?: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface SpendQuote {
  ngnAmount: number;
  usdcAmount: number;
  exchangeRate: number;
  platformFee: number;
  totalUSDCRequired: number;
  estimatedCompletionTime: string;
}

/** Processing sub-steps displayed in the status UI */
export type ProcessingSubStep =
  | "approving"
  | "sending"
  | "bank-transfer"
  | "complete"
  | "error";
