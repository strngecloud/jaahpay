-- Initial database schema for Jahpay Spending Feature

-- Spends table
CREATE TABLE IF NOT EXISTS spends (
    id BIGSERIAL PRIMARY KEY,
    spend_id VARCHAR(66) UNIQUE NOT NULL,
    user_address VARCHAR(42) NOT NULL,
    chain VARCHAR(20) NOT NULL DEFAULT 'celo',
    
    -- Amounts
    usdc_amount DECIMAL(20, 6) NOT NULL,
    ngn_amount DECIMAL(20, 2) NOT NULL,
    exchange_rate DECIMAL(10, 2) NOT NULL,
    platform_fee_usdc DECIMAL(20, 6) NOT NULL,
    
    -- Recipient Details
    recipient_account_number VARCHAR(10) NOT NULL,
    recipient_bank_code VARCHAR(10) NOT NULL,
    recipient_account_name VARCHAR(255),
    narration VARCHAR(255),
    
    -- Status & Tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    bank_reference VARCHAR(100),
    error_message TEXT,
    transaction_hash VARCHAR(66),
    block_number INT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes for spends
CREATE INDEX idx_spends_user_address ON spends(user_address);
CREATE INDEX idx_spends_status ON spends(status);
CREATE INDEX idx_spends_created_at ON spends(created_at);
CREATE INDEX idx_spends_user_created ON spends(user_address, created_at);

-- Bank API logs table
CREATE TABLE IF NOT EXISTS bank_api_logs (
    id BIGSERIAL PRIMARY KEY,
    spend_id VARCHAR(66) NOT NULL,
    api_provider VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_payload JSONB NOT NULL,
    response_payload JSONB,
    status_code INT,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    response_time_ms INT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for bank API logs
CREATE INDEX idx_bank_api_logs_spend_id ON bank_api_logs(spend_id);
CREATE INDEX idx_bank_api_logs_created_at ON bank_api_logs(created_at);
CREATE INDEX idx_bank_api_logs_provider ON bank_api_logs(api_provider);

-- User spend limits table
CREATE TABLE IF NOT EXISTS user_spend_limits (
    user_address VARCHAR(42) PRIMARY KEY,
    daily_limit_usdc DECIMAL(20, 6) DEFAULT 100.00,
    monthly_limit_usdc DECIMAL(20, 6) DEFAULT 1000.00,
    daily_spent_usdc DECIMAL(20, 6) DEFAULT 0,
    monthly_spent_usdc DECIMAL(20, 6) DEFAULT 0,
    last_daily_reset DATE,
    last_monthly_reset DATE,
    is_verified BOOLEAN DEFAULT FALSE,
    kyc_level INT DEFAULT 1,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    blacklist_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for spends table
CREATE TRIGGER update_spends_updated_at BEFORE UPDATE ON spends
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_spend_limits table
CREATE TRIGGER update_user_spend_limits_updated_at BEFORE UPDATE ON user_spend_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE spends IS 'Stores all spending transactions';
COMMENT ON TABLE bank_api_logs IS 'Audit log for all bank API calls';
COMMENT ON TABLE user_spend_limits IS 'User spending limits and KYC information';

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
