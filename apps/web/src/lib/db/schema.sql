-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT UNIQUE NOT NULL,
    country_code TEXT,
    preferred_provider TEXT,
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table
-- Columns match TransactionDb (src/lib/transactions/db.ts) and the
-- admin /api/admin/transactions route, not the on-ramp/off-ramp shape
-- this table used before the swap-only refactor.
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_address TEXT,
    type TEXT NOT NULL CHECK (type IN ('swap', 'send', 'receive', 'deposit', 'withdrawal')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
    from_token TEXT,
    to_token TEXT,
    from_amount TEXT,
    to_amount TEXT,
    platform_fee TEXT,
    tx_hash TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exchange rates cache
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate DECIMAL(18, 6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(provider, from_currency, to_currency)
);

-- Provider status tracking
CREATE TABLE IF NOT EXISTS provider_status (
    provider TEXT PRIMARY KEY,
    is_active BOOLEAN DEFAULT true,
    success_rate DECIMAL(5, 2),
    avg_completion_time INTEGER,
    last_checked_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Bank accounts (for off-ramps)
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL,
    bank_code TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    country_code TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, account_number, bank_code)
);

-- Referral codes
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    uses INTEGER DEFAULT 0,
    rewards_earned DECIMAL(18, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_address ON transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_expires ON exchange_rates(expires_at);
