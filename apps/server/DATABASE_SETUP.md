# Jahpay Spending - Database Setup Guide

## ✅ Database Created Successfully

The `jahpay_spending` PostgreSQL database has been created with all required tables and indexes.

### Database Details

```
Database Name: jahpay_spending
Host: localhost
Port: 5432
Username: postgres
```

## Database Schema

### 1. **spends** Table

Main transaction records for all spending operations.

| Column                     | Type          | Description                                  |
| -------------------------- | ------------- | -------------------------------------------- |
| `id`                       | BIGINT (PK)   | Auto-incrementing primary key                |
| `spend_id`                 | VARCHAR(66)   | Unique blockchain spend ID                   |
| `user_address`             | VARCHAR(42)   | Ethereum address of user                     |
| `chain`                    | VARCHAR(20)   | Blockchain: 'celo' or 'base'                 |
| `usdc_amount`              | DECIMAL(20,6) | Amount in USDC (6 decimals)                  |
| `ngn_amount`               | DECIMAL(20,2) | Amount in NGN (Nigerian Naira)               |
| `exchange_rate`            | DECIMAL(10,2) | USD to NGN rate at time of spend             |
| `platform_fee_usdc`        | DECIMAL(20,6) | Platform fee deducted                        |
| `recipient_account_number` | VARCHAR(10)   | Bank account number (10 digits)              |
| `recipient_bank_code`      | VARCHAR(10)   | Bank code (e.g., 058, 035)                   |
| `recipient_account_name`   | VARCHAR(255)  | Account holder name                          |
| `narration`                | VARCHAR(255)  | Transaction description                      |
| `status`                   | VARCHAR(20)   | pending/processing/completed/refunded/failed |
| `bank_reference`           | VARCHAR(100)  | Bank transaction reference                   |
| `error_message`            | TEXT          | Error details if failed                      |
| `transaction_hash`         | VARCHAR(66)   | Blockchain transaction hash                  |
| `block_number`             | INT           | Block number on blockchain                   |
| `created_at`               | TIMESTAMP     | When spend was initiated                     |
| `updated_at`               | TIMESTAMP     | Last update (auto-updated)                   |
| `processed_at`             | TIMESTAMP     | When backend started processing              |
| `completed_at`             | TIMESTAMP     | When spend was completed/refunded            |

**Indexes:**

- `spends_pkey` - Primary key
- `spends_spend_id_key` - Unique spend_id
- `idx_spends_user_address` - Quick lookup by user
- `idx_spends_status` - Query by status
- `idx_spends_created_at` - Query by date
- `idx_spends_user_created` - Composite: user + date

**Triggers:**

- `update_spends_updated_at` - Auto-updates `updated_at` on any change

### 2. **bank_api_logs** Table

Audit trail for all bank API calls (debugging and compliance).

| Column             | Type         | Description                       |
| ------------------ | ------------ | --------------------------------- |
| `id`               | BIGINT (PK)  | Auto-incrementing primary key     |
| `spend_id`         | VARCHAR(66)  | Reference to spend transaction    |
| `api_provider`     | VARCHAR(50)  | 'paystack' or 'flutterwave'       |
| `endpoint`         | VARCHAR(255) | API endpoint called               |
| `request_payload`  | JSONB        | Request body (sanitized)          |
| `response_payload` | JSONB        | Response body                     |
| `status_code`      | INT          | HTTP status code                  |
| `success`          | BOOLEAN      | Whether API call succeeded        |
| `error_message`    | TEXT         | Error message if failed           |
| `response_time_ms` | INT          | Response time in milliseconds     |
| `created_at`       | TIMESTAMP    | When API was called               |

**Indexes:**

- `bank_api_logs_pkey` - Primary key
- `idx_bank_api_logs_spend_id` - Lookup by spend
- `idx_bank_api_logs_created_at` - Lookup by date
- `idx_bank_api_logs_provider` - Filter by provider

### 3. **user_spend_limits** Table

Per-user spending limits and KYC level management.

| Column               | Type             | Description                         |
| -------------------- | ---------------- | ----------------------------------- |
| `user_address`       | VARCHAR(42) (PK) | Ethereum address                    |
| `daily_limit_usdc`   | DECIMAL(20,6)    | Daily spending limit in USDC        |
| `monthly_limit_usdc` | DECIMAL(20,6)    | Monthly spending limit in USDC      |
| `daily_spent_usdc`   | DECIMAL(20,6)    | Amount spent today                  |
| `monthly_spent_usdc` | DECIMAL(20,6)    | Amount spent this month             |
| `last_daily_reset`   | DATE             | When daily counter was last reset   |
| `last_monthly_reset` | DATE             | When monthly counter was last reset |
| `is_verified`        | BOOLEAN          | Whether user is verified (KYC)      |
| `kyc_level`          | INT              | 1: Basic, 2: Intermediate, 3: Full  |
| `is_blacklisted`     | BOOLEAN          | Whether user is blacklisted         |
| `blacklist_reason`   | TEXT             | Reason for blacklist                |
| `created_at`         | TIMESTAMP        | When user record created            |
| `updated_at`         | TIMESTAMP        | Last update (auto-updated)          |

**Default Limits by KYC Level:**

- Level 1 (Basic): $100/day, $1,000/month
- Level 2 (Intermediate): $500/day, $5,000/month
- Level 3 (Full): $2,000/day, $20,000/month

**Indexes:**

- `user_spend_limits_pkey` - Primary key (user_address)

**Triggers:**

- `update_user_spend_limits_updated_at` - Auto-updates `updated_at` on any change

## Connection String

```
postgresql://postgres:postgres@localhost:5432/jahpay_spending
```

For TypeORM (from your `apps/server/.env`):

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=jahpay_spending
```

## Useful SQL Queries

### Get all spends for a user

```sql
SELECT spend_id, status, usdc_amount, ngn_amount, created_at, completed_at
FROM spends
WHERE user_address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
ORDER BY created_at DESC
LIMIT 20;
```

### Check daily spending

```sql
SELECT user_address, daily_spent_usdc, daily_limit_usdc,
       (daily_limit_usdc - daily_spent_usdc) as remaining
FROM user_spend_limits
WHERE daily_spent_usdc > 0;
```

### View failed transactions

```sql
SELECT spend_id, user_address, ngn_amount, error_message, created_at
FROM spends
WHERE status IN ('failed', 'refunded')
ORDER BY created_at DESC;
```

### View bank API errors

```sql
SELECT spend_id, api_provider, endpoint, error_message, response_time_ms, created_at
FROM bank_api_logs
WHERE success = false
ORDER BY created_at DESC
LIMIT 50;
```

### Calculate daily volumes

```sql
SELECT DATE(created_at) as date, COUNT(*) as transactions,
       SUM(ngn_amount) as total_ngn,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful
FROM spends
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Get user KYC summary

```sql
SELECT user_address, kyc_level, is_verified, daily_limit_usdc,
       monthly_limit_usdc, is_blacklisted, blacklist_reason
FROM user_spend_limits
ORDER BY created_at DESC;
```

## Database Maintenance

### Backup Database

```bash
# Full backup
pg_dump -U postgres jahpay_spending > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump -U postgres jahpay_spending | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore Database

```bash
# Restore from backup
psql -U postgres jahpay_spending < backup_20240315_100000.sql

# Restore from compressed backup
gunzip -c backup_20240315_100000.sql.gz | psql -U postgres jahpay_spending
```

### Clear All Data (Development Only)

```bash
# Warning: This deletes all data!
psql -U postgres -d jahpay_spending << 'EOF'
TRUNCATE spends CASCADE;
TRUNCATE bank_api_logs CASCADE;
TRUNCATE user_spend_limits CASCADE;
EOF
```

### Vacuum & Analyze (Maintenance)

```bash
# Clean up dead tuples and analyze query plans
psql -U postgres -d jahpay_spending -c "VACUUM ANALYZE;"
```

## Troubleshooting

### Cannot Connect to Database

```bash
# Check if PostgreSQL is running
sudo service postgresql status

# Or with Docker
docker-compose ps postgres

# Check connection
psql -U postgres -h localhost -d jahpay_spending -c "SELECT 1;"
```

### Slow Queries

Check indexes and query plans:

```sql
-- Find missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public';

-- Analyze slow query
EXPLAIN ANALYZE
SELECT * FROM spends WHERE user_address = '0x...';
```

### Disk Space Issues

```sql
-- Check table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### High Table Size

Archive old transactions:

```sql
-- Archive spends older than 90 days
INSERT INTO spends_archive
SELECT * FROM spends
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM spends
WHERE created_at < NOW() - INTERVAL '90 days';
```

## Production Checklist

Before going to production:

- [ ] Set up automated backups (daily)
- [ ] Configure replication (standby server)
- [ ] Set up monitoring (CPU, disk, connections)
- [ ] Configure WAL archiving
- [ ] Set up vacuum schedule
- [ ] Configure connection limits
- [ ] Enable audit logging
- [ ] Restrict direct access (only via app)
- [ ] Use strong passwords
- [ ] Set up SSL/TLS connections
- [ ] Regular security audits

## Database Monitoring

### Monitor Active Connections

```sql
SELECT datname, usename, application_name, state
FROM pg_stat_activity
WHERE datname = 'jahpay_spending';
```

### Monitor Cache Hit Ratio

```sql
SELECT sum(heap_blks_read) as heap_read,
       sum(heap_blks_hit)  as heap_hit,
       sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
```

## Next Steps

1. ✅ Database created
2. ✅ Tables and indexes created
3. ✅ Migrations applied
4. Next: Update `.env` in `apps/server`
5. Next: Start NestJS backend with `pnpm run start:dev`
6. Next: Backend will auto-create initial user records via TypeORM

## Support

- PostgreSQL Docs: https://www.postgresql.org/docs/
- TypeORM Docs: https://typeorm.io/
- Query Builder: https://www.pgadmin.org/

---

**Database Ready! 🚀**

Your `jahpay_spending` database is fully configured and ready for the backend service.
