export enum SpendStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum Chain {
  CELO = 'celo',
  BASE = 'base',
}

export enum BankProvider {
  PAYSTACK = 'paystack',
  FLUTTERWAVE = 'flutterwave',
}

export enum KYCLevel {
  BASIC = 1,
  INTERMEDIATE = 2,
  FULL = 3,
}

export interface SpendInitiatedEvent {
  spendId: string;
  user: string;
  usdcAmount: string;
  ngnAmount: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  chain: Chain;
}

export interface SpendCompletedEvent {
  spendId: string;
  bankTransactionRef: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

export interface SpendRefundedEvent {
  spendId: string;
  reason: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

export interface BankTransferRequest {
  accountNumber: string;
  bankCode: string;
  accountName?: string;
  amount: number;
  narration: string;
  reference: string;
}

export interface BankTransferResponse {
  success: boolean;
  reference: string;
  status: string;
  message?: string;
  data?: any;
}

export interface BankAccountValidation {
  accountNumber: string;
  bankCode: string;
  accountName?: string;
  valid: boolean;
}

export interface BankInfo {
  code: string;
  name: string;
  slug?: string;
  logo?: string;
}

export interface ExchangeRate {
  usdToNgn: number;
  source: string;
  timestamp: Date;
  confidence: number;
}

export interface SpendLimits {
  dailyLimitUsdc: number;
  monthlyLimitUsdc: number;
  dailySpent: number;
  monthlySpent: number;
  isVerified: boolean;
  kycLevel: KYCLevel;
}
