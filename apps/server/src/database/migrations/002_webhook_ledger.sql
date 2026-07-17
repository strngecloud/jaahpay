-- Adds tables the entities expect but 001_init.sql never created:
-- webhook_logs (WebhookLogEntity) and ledger_entries (LedgerEntryEntity).
-- Columns are snake_case to match the app's SnakeNamingStrategy. Enum-typed
-- entity fields are stored as VARCHAR here, matching how spends.status/chain
-- are already modelled.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS webhook_logs (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    webhook_id VARCHAR(255) UNIQUE NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    processed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON webhook_logs (provider);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed_at ON webhook_logs (processed_at);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spend_id VARCHAR(66) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    debit_amount DECIMAL(20, 6) NOT NULL DEFAULT 0,
    credit_amount DECIMAL(20, 6) NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    is_immutable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_spend_id ON ledger_entries (spend_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_type ON ledger_entries (account_type);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON ledger_entries (created_at);
