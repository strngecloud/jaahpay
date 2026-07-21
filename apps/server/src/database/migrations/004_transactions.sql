-- Swap history (TransactionEntity). Moved off Supabase so the server's
-- Postgres is the single source of truth. Columns are snake_case to match
-- the app's SnakeNamingStrategy. Enum-typed fields are stored as VARCHAR,
-- matching spends.status/chain and support_tickets.
--
-- The primary key is the on-chain tx hash: the web app uses it as the id so
-- re-saving the same swap is idempotent.

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(128) PRIMARY KEY,
    user_address VARCHAR(42),
    type VARCHAR(20) NOT NULL DEFAULT 'swap',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    from_token VARCHAR(66),
    to_token VARCHAR(66),
    from_amount VARCHAR(78),
    to_amount VARCHAR(78),
    platform_fee VARCHAR(78),
    tx_hash VARCHAR(66),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created
    ON transactions (user_address, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash
    ON transactions (tx_hash);
