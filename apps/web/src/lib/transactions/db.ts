/**
 * Database layer for transactions.
 *
 * Swap history is persisted in the NestJS server's Postgres (the single source
 * of truth) via the /transactions API. Previously this talked to Supabase; the
 * public method shapes are unchanged so callers (transaction service, the
 * /api/transactions/save route) did not need to change.
 */

import { Transaction } from './types';

const API_URL =
    process.env.NEXT_PUBLIC_SPEND_API_URL || 'http://localhost:3001/api/v1';

/** snake_case row shape kept for backwards compatibility with callers. */
export interface DbTransaction {
    id: string;
    user_address?: string;
    type: string;
    status: string;
    from_token?: string;
    to_token?: string;
    from_amount: string;
    to_amount: string;
    platform_fee?: string;
    tx_hash?: string;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
}

/** camelCase entity shape the server returns. */
interface ServerTransaction {
    id: string;
    userAddress?: string | null;
    type: string;
    status: string;
    fromToken?: string | null;
    toToken?: string | null;
    fromAmount?: string | null;
    toAmount?: string | null;
    platformFee?: string | null;
    txHash?: string | null;
    metadata?: Record<string, any> | null;
    createdAt: string;
    updatedAt: string;
}

function toDbTransaction(t: ServerTransaction): DbTransaction {
    return {
        id: t.id,
        user_address: t.userAddress ?? undefined,
        type: t.type,
        status: t.status,
        from_token: t.fromToken ?? undefined,
        to_token: t.toToken ?? undefined,
        from_amount: t.fromAmount ?? '',
        to_amount: t.toAmount ?? '',
        platform_fee: t.platformFee ?? undefined,
        tx_hash: t.txHash ?? undefined,
        metadata: t.metadata ?? {},
        created_at: t.createdAt,
        updated_at: t.updatedAt,
    };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Request failed (${res.status})`);
    }
    return res.json();
}

export class TransactionDb {
    /**
     * Save (upsert) a transaction to the server DB. Keyed by tx hash so a
     * repeat save is idempotent.
     */
    static async saveTransaction(
        tx: Transaction,
        userAddress?: string
    ): Promise<boolean> {
        try {
            await apiFetch('/transactions', {
                method: 'POST',
                body: JSON.stringify({
                    id: tx.id,
                    userAddress,
                    type: tx.type,
                    status: tx.status,
                    fromToken: tx.metadata.fromAddress,
                    toToken: tx.metadata.toAddress,
                    fromAmount: tx.fromAmount,
                    toAmount: tx.toAmount,
                    platformFee: tx.fee,
                    txHash: tx.metadata.txHash,
                    metadata: tx.metadata,
                }),
            });
            console.log('[TransactionDb] Transaction saved:', tx.id);
            return true;
        } catch (error) {
            console.error('[TransactionDb] Failed to save transaction:', error);
            return false;
        }
    }

    /** Update a transaction's status/fields on the server. */
    static async updateTransaction(
        txId: string,
        updates: Partial<DbTransaction>
    ): Promise<boolean> {
        try {
            await apiFetch(`/transactions/${encodeURIComponent(txId)}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: updates.status,
                    txHash: updates.tx_hash,
                    toAmount: updates.to_amount,
                    platformFee: updates.platform_fee,
                    metadata: updates.metadata,
                }),
            });
            console.log('[TransactionDb] Transaction updated:', txId);
            return true;
        } catch (error) {
            console.error('[TransactionDb] Failed to update transaction:', error);
            return false;
        }
    }

    /** Fetch a user's transactions from the server DB. */
    static async fetchUserTransactions(
        userAddress: string,
        limit: number = 50
    ): Promise<DbTransaction[]> {
        try {
            const res = await apiFetch<{ transactions: ServerTransaction[] }>(
                `/transactions?userAddress=${encodeURIComponent(
                    userAddress
                )}&limit=${limit}`
            );
            return (res.transactions || []).map(toDbTransaction);
        } catch (error) {
            console.error('[TransactionDb] Failed to fetch transactions:', error);
            return [];
        }
    }
}
