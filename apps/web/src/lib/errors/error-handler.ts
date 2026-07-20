/**
 * Error categorization and handling utilities
 * Provides consistent error handling across the application
 */

export enum ErrorCategory {
    NETWORK = 'network',
    USER = 'user',
    CONTRACT = 'contract',
    VALIDATION = 'validation',
    RATE_LIMIT = 'rate_limit',
    UNKNOWN = 'unknown',
}

export interface CategorizedError {
    category: ErrorCategory;
    message: string;
    userMessage: string;
    retryable: boolean;
    originalError?: Error;
}

/**
 * Pull the most descriptive string out of an unknown error. viem/wagmi errors
 * carry a concise `shortMessage`; plain Errors only have `message`.
 */
function extractMessage(error: unknown): string {
    if (error && typeof error === 'object') {
        const e = error as { shortMessage?: unknown; message?: unknown };
        if (typeof e.shortMessage === 'string' && e.shortMessage) return e.shortMessage;
        if (typeof e.message === 'string' && e.message) return e.message;
    }
    return error instanceof Error ? error.message : String(error);
}

/**
 * A wallet reported a stale nonce (it tried to reuse a nonce the chain has
 * already seen). Callers can recover by re-fetching the pending nonce and
 * resubmitting, so this is matched separately from generic contract reverts.
 */
export function isNonceError(error: unknown): boolean {
    const msg = extractMessage(error).toLowerCase();
    return (
        msg.includes('nonce too low') ||
        msg.includes('next nonce') ||
        msg.includes('nonce is too low') ||
        msg.includes('invalid nonce') ||
        (msg.includes('nonce') && msg.includes('low'))
    );
}

/** The user dismissed the wallet prompt — a deliberate cancel, not a failure. */
export function isUserRejection(error: unknown): boolean {
    const msg = extractMessage(error).toLowerCase();
    return (
        msg.includes('user rejected') ||
        msg.includes('user denied') ||
        msg.includes('rejected the request') ||
        msg.includes('request rejected') ||
        msg.includes('denied transaction')
    );
}

/**
 * Categorize an error and provide user-friendly messaging.
 *
 * `userMessage` is safe to render directly in the UI — it never leaks a raw
 * RPC string, stack, or hex selector. Order matters: the most specific,
 * actionable cases are checked before the generic buckets.
 */
export function categorizeError(error: unknown): CategorizedError {
    const errorMessage = extractMessage(error);
    const lowerMessage = errorMessage.toLowerCase();
    const originalError = error instanceof Error ? error : undefined;

    // Wallet prompt dismissed — treat as a cancel, not an error to retry blindly.
    if (isUserRejection(error)) {
        return {
            category: ErrorCategory.USER,
            message: errorMessage,
            userMessage: 'You cancelled the request in your wallet.',
            retryable: false,
            originalError,
        };
    }

    // Stale wallet nonce — recoverable by resubmitting with a fresh nonce.
    if (isNonceError(error)) {
        return {
            category: ErrorCategory.CONTRACT,
            message: errorMessage,
            userMessage:
                'Your wallet was briefly out of sync. Please try again — if it keeps happening, reset your wallet’s account activity and retry.',
            retryable: true,
            originalError,
        };
    }

    // Not enough native CELO to pay gas.
    if (
        lowerMessage.includes('insufficient funds') ||
        lowerMessage.includes('gas required exceeds') ||
        lowerMessage.includes('exceeds the balance of the account')
    ) {
        return {
            category: ErrorCategory.USER,
            message: errorMessage,
            userMessage:
                'Not enough CELO to cover the network fee. Add a little CELO for gas and try again.',
            retryable: false,
            originalError,
        };
    }

    // Not enough token balance / allowance to move the funds.
    if (
        lowerMessage.includes('transfer amount exceeds balance') ||
        lowerMessage.includes('insufficient allowance') ||
        lowerMessage.includes('insufficient balance') ||
        lowerMessage.includes('exceeds balance')
    ) {
        return {
            category: ErrorCategory.USER,
            message: errorMessage,
            userMessage:
                'Insufficient USDC balance for this transfer. Check your balance and try again.',
            retryable: false,
            originalError,
        };
    }

    // Network errors
    if (
        lowerMessage.includes('network') ||
        lowerMessage.includes('fetch') ||
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('connection') ||
        lowerMessage.includes('econnrefused')
    ) {
        return {
            category: ErrorCategory.NETWORK,
            message: errorMessage,
            userMessage: 'Network error. Please check your connection and try again.',
            retryable: true,
            originalError,
        };
    }

    // Rate limiting
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
        return {
            category: ErrorCategory.RATE_LIMIT,
            message: errorMessage,
            userMessage: 'Too many requests. Please wait a moment and try again.',
            retryable: true,
            originalError,
        };
    }

    // Amount validation — safe to surface verbatim (already human-authored).
    if (
        lowerMessage.includes('invalid amount') ||
        lowerMessage.includes('minimum amount') ||
        lowerMessage.includes('maximum amount') ||
        lowerMessage.includes('required') ||
        lowerMessage.includes('must be')
    ) {
        return {
            category: ErrorCategory.VALIDATION,
            message: errorMessage,
            userMessage: errorMessage,
            retryable: false,
            originalError,
        };
    }

    // Contract/blockchain errors (revert, out of gas, etc.) — never show the
    // raw revert string or selector; give a calm, actionable message.
    if (
        lowerMessage.includes('revert') ||
        lowerMessage.includes('gas') ||
        lowerMessage.includes('nonce') ||
        lowerMessage.includes('execution') ||
        lowerMessage.includes('transaction') ||
        lowerMessage.includes('contract')
    ) {
        return {
            category: ErrorCategory.CONTRACT,
            message: errorMessage,
            userMessage: 'The transaction couldn’t be completed. Please try again in a moment.',
            retryable: true,
            originalError,
        };
    }

    // Unknown errors
    return {
        category: ErrorCategory.UNKNOWN,
        message: errorMessage,
        userMessage: 'Something went wrong. Please try again.',
        retryable: true,
        originalError,
    };
}

/**
 * Turn a message that originated server-side (e.g. a spend's stored
 * `errorMessage`) into something safe to show a user.
 *
 * Clean, human-authored reasons (a short bank decline like "Insufficient
 * balance") are shown as-is; raw technical dumps (multi-line viem/RPC errors,
 * revert selectors, nonce traces) are replaced with a friendly equivalent so
 * we never render a stack of "Request Arguments:" / hex data at the user.
 */
export function toUserFacingMessage(
    raw: string | null | undefined,
    fallback = 'The transfer could not be completed. Please try again.'
): string {
    if (!raw) return fallback;
    const trimmed = raw.trim();
    if (!trimmed) return fallback;

    const looksTechnical =
        trimmed.length > 140 ||
        trimmed.includes('\n') ||
        /0x[0-9a-f]{6,}/i.test(trimmed) ||
        /\b(nonce|revert|rpc|viem|eth_|gas required|execution reverted|request arguments)\b/i.test(
            trimmed
        );

    return looksTechnical ? categorizeError(trimmed).userMessage : trimmed;
}

/**
 * Retry logic with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const categorized = categorizeError(error);

            // Don't retry non-retryable errors
            if (!categorized.retryable) {
                throw error;
            }

            // Don't retry on last attempt
            if (attempt === maxRetries - 1) {
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s, etc.
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Log error with context
 */
export function logError(
    context: string,
    error: unknown,
    additionalData?: Record<string, unknown>
) {
    const categorized = categorizeError(error);
    console.error(`[${context}] ${categorized.category.toUpperCase()}:`, {
        message: categorized.message,
        category: categorized.category,
        retryable: categorized.retryable,
        ...additionalData,
    });
}
