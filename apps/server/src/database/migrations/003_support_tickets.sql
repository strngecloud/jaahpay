-- Support tickets for the in-app support system (SupportTicketEntity).
-- Columns are snake_case to match the app's SnakeNamingStrategy. Enum-typed
-- entity fields are stored as VARCHAR, matching spends.status/chain.

CREATE TABLE IF NOT EXISTS support_tickets (
    id BIGSERIAL PRIMARY KEY,
    ticket_ref VARCHAR(20) UNIQUE NOT NULL,
    user_address VARCHAR(42),
    email VARCHAR(255),
    category VARCHAR(20) NOT NULL DEFAULT 'other',
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    spend_id VARCHAR(66),
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_created
    ON support_tickets (user_address, created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
    ON support_tickets (status);
