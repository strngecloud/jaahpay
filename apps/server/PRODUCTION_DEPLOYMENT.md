# Production Deployment Guide - Jahpay Spending Feature

## ✅ Security Features Implemented

### 1. **Fraud Detection System**

- ✅ Velocity limiting (2/min, 10/hour, 50/day)
- ✅ Duplicate transaction detection (5-minute window)
- ✅ Replay attack prevention (24-hour nonce tracking)
- ✅ Risk scoring algorithm (velocity + amount + time + user age)
- ✅ Auto-block transactions with critical risk (score >70)

### 2. **Webhook Security**

- ✅ HMAC SHA512 signature verification (Paystack)
- ✅ Secret-hash verification (Flutterwave `verif-hash`)
- ✅ Idempotency checks (prevent duplicate processing)
- ✅ Redis-based deduplication (24-hour window)
- ✅ <5 second response time requirement

### 3. **Blockchain Transaction Completion**

- ✅ `completeSpend()` called after successful bank transfer
- ✅ `refundSpend()` called after failed bank transfer
- ✅ `emergencyRefund()` for timed out transactions (15+ minutes)
- ✅ 2-confirmation waiting for transaction finality
- ✅ Processor wallet authorization enforcement

### 4. **Timeout Protection**

- ✅ Auto-refund after 15 minutes (cron job every 2 minutes)
- ✅ Batch processing of timed out spends
- ✅ Automatic blockchain refund trigger

### 5. **General Security**

- ✅ ReentrancyGuard on all spend functions
- ✅ Pausable contract (emergency stop)
- ✅ Processor authorization (only authorized wallets can complete/refund)
- ✅ Input validation on all endpoints
- ✅ SQL injection protection (TypeORM parameterized queries)

---

## 🚀 Deployment Checklist

### Prerequisites

1. **Infrastructure**
   - [ ] PostgreSQL database (v15+)
   - [ ] Redis instance (v7+)
   - [ ] Node.js runtime (v18+)
   - [ ] SSL certificates (for webhooks)

2. **Blockchain**
   - [ ] Deploy SpendRouter contract to Celo mainnet
   - [ ] Deploy SpendRouter contract to Base mainnet
   - [ ] Create processor wallet
   - [ ] Authorize processor wallet on both contracts
   - [ ] Transfer CELO/ETH to processor wallet for gas

3. **Banking APIs**
   - [ ] Paystack production API credentials
   - [ ] Flutterwave production API credentials
   - [ ] Virtual bank account setup
   - [ ] Webhook URLs registered with banks

### Step 1: Environment Configuration

Create `.env.production` file:

```bash
# Node Environment
NODE_ENV=production

# Database
DATABASE_HOST=prod-db.example.com
DATABASE_PORT=5432
DATABASE_USERNAME=jahpay_prod
DATABASE_PASSWORD=<STRONG_PASSWORD>
DATABASE_NAME=jahpay_prod
DATABASE_SYNCHRONIZE=false  # NEVER true in production
DATABASE_LOGGING=false

# Redis
REDIS_URL=redis://prod-redis.example.com:6379

# Blockchain RPCs
CELO_RPC_URL=https://forno.celo.org
BASE_RPC_URL=https://mainnet.base.org

# SpendRouter Contracts
SPEND_ROUTER_ADDRESS_CELO=0x... # From deployment
SPEND_ROUTER_ADDRESS_BASE=0x... # From deployment

# CRITICAL: Processor Wallet (Store in AWS Secrets Manager!)
PROCESSOR_WALLET_PRIVATE_KEY=0x...  # DO NOT COMMIT

# Paystack
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_CALLBACK_URL=https://api.jahpay.com/webhooks/paystack

# Flutterwave
FLUTTERWAVE_API_URL=https://api.flutterwave.com/v3
FLUTTERWAVE_SECRET_KEY=<PROD_KEY>
FLUTTERWAVE_SECRET_HASH=<WEBHOOK_SECRET_HASH>
```

### Step 2: Database Migration

```bash
# Run migrations (TypeORM)
npm run migration:run

# Verify tables created
psql -h prod-db.example.com -U jahpay_prod -d jahpay_prod -c "\dt"

# Expected tables:
# - spends
# - webhook_logs
# - bank_api_logs
# - user_spend_limits
```

### Step 3: Deploy Smart Contracts

```bash
cd apps/contracts

# Deploy to Celo mainnet
forge script script/Deploy.s.sol --rpc-url $CELO_RPC_URL --broadcast --verify

# Deploy to Base mainnet
forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify

# Save contract addresses to .env
```

### Step 4: Authorize Processor Wallet

```typescript
// Use Foundry cast or ethers.js
cast send $SPEND_ROUTER_ADDRESS \
  "authorizeProcessor(address)" \
  $PROCESSOR_WALLET_ADDRESS \
  --rpc-url $CELO_RPC_URL \
  --private-key $OWNER_PRIVATE_KEY
```

### Step 5: Start Server

```bash
# Install dependencies
npm install

# Build
npm run build

# Start with PM2 (recommended)
pm2 start dist/main.js --name jahpay-server -i max

# Or use Docker
docker build -t jahpay-server .
docker run -d -p 3000:3000 --env-file .env.production jahpay-server
```

### Step 6: Verify Health

```bash
# Check server health
curl https://api.jahpay.com/health

# Check blockchain listeners started
# Look for logs:
# "Starting Celo event listener at 0x..."
# "Starting Base event listener at 0x..."
# "Processor wallet: 0x..."

# Test webhook endpoint
curl -X POST https://api.jahpay.com/webhooks/health
```

---

## 🔒 Security Best Practices

### 1. Processor Wallet Management

**CRITICAL:** The processor wallet private key MUST be stored securely.

**Recommended: AWS Secrets Manager**

```typescript
// In production code:
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async getProcessorKey() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const command = new GetSecretValueCommand({
    SecretId: 'jahpay/processor-wallet-key',
  });
  const response = await client.send(command);
  return response.SecretString;
}
```

### 2. Rate Limiting

Add nginx rate limiting in front of your API:

```nginx
# /etc/nginx/sites-available/jahpay-api
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
  listen 443 ssl;
  server_name api.jahpay.com;

  location /api/v1/spend/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://localhost:3000;
  }

  location /webhooks/ {
    # No rate limit for webhooks
    proxy_pass http://localhost:3000;
  }
}
```

### 3. Monitoring & Alerting

**Sentry (Error Tracking)**

```bash
npm install @sentry/node

# Add to main.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
});
```

**DataDog (APM)**

```bash
npm install dd-trace

# Run with:
node -r dd-trace/init dist/main.js
```

**Alert Rules:**

- Processor wallet balance < 0.1 CELO/ETH
- Redis connection failure
- Database connection failure
- Blockchain transaction revert rate >5%
- Webhook processing latency >3s

### 4. Database Backups

```bash
# Automated daily backups
0 2 * * * pg_dump -h prod-db.example.com -U jahpay_prod jahpay_prod | gzip > /backups/jahpay_$(date +\%Y\%m\%d).sql.gz

# Retention: 30 days
find /backups -name "jahpay_*.sql.gz" -mtime +30 -delete
```

---

## 📊 Monitoring Dashboard

### Key Metrics to Track

1. **Transaction Metrics**
   - Total spends initiated (per hour/day)
   - Success rate (completed / total)
   - Average completion time
   - Refund rate

2. **Fraud Metrics**
   - Transactions blocked by fraud checks
   - Risk score distribution
   - Velocity violations
   - Duplicate detections

3. **System Health**
   - API response time (p50, p95, p99)
   - Database query performance
   - Redis hit rate
   - Blockchain RPC latency

4. **Financial Metrics**
   - Total NGN processed
   - Total USDC locked in escrow
   - Platform fees collected
   - Processor wallet balance

### Example Grafana Queries

```sql
-- Success rate (last 24 hours)
SELECT
  COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*) * 100 as success_rate
FROM spends
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Average completion time
SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds
FROM spends
WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours';

-- Fraud blocks (last hour)
SELECT COUNT(*)
FROM spends
WHERE error_message LIKE '%Fraud check failed%'
  AND created_at > NOW() - INTERVAL '1 hour';
```

---

## 🚨 Incident Response

### Scenario 1: Processor Wallet Compromised

1. **Immediately revoke authorization:**

   ```bash
   cast send $SPEND_ROUTER_ADDRESS \
     "revokeProcessor(address)" \
     $COMPROMISED_WALLET \
     --rpc-url $CELO_RPC_URL \
     --private-key $OWNER_KEY
   ```

2. **Pause contract:**

   ```bash
   cast send $SPEND_ROUTER_ADDRESS "pause()" \
     --rpc-url $CELO_RPC_URL \
     --private-key $OWNER_KEY
   ```

3. **Create new processor wallet**
4. **Authorize new wallet**
5. **Update .env and redeploy**
6. **Unpause contract**

### Scenario 2: Bank API Downtime

- Automatic failover to secondary provider (Paystack)
- Queue transactions for retry
- Display status page: "Bank transfers experiencing delays"

### Scenario 3: USDC Stuck in Contract

**Cause:** Bank transfer succeeded but blockchain completion failed

**Recovery:**

```typescript
// Manually call completeSpend
await blockchainService.completeSpend(spendId, bankReference, chain);
```

---

## 📝 Post-Deployment Verification

Run these checks after deployment:

```bash
# 1. Test small transaction end-to-end
curl -X POST https://api.jahpay.com/api/v1/spend/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0xTEST",
    "ngnAmount": 1000,
    "recipientAccountNumber": "0123456789",
    "recipientBankCode": "035",
    "narration": "Test",
    "chain": "celo"
  }'

# 2. Verify fraud checks working
# (Should be blocked after 2 requests in 1 minute)

# 3. Test webhook endpoint
curl -X POST https://api.jahpay.com/webhooks/paystack \
  -H "x-paystack-signature: test" \
  -H "Content-Type: application/json" \
  -d '{}'

# 4. Check cron job running
# Wait 2 minutes and check logs for "Found X timed out spends"

# 5. Verify database writes
psql -h prod-db.example.com -U jahpay_prod -d jahpay_prod \
  -c "SELECT COUNT(*) FROM spends;"
```

---

## 📞 Support Contacts

- **DevOps**: devops@jahpay.com
- **Backend Lead**: backend@jahpay.com
- **On-Call**: +234-XXX-XXXX-XXX
- **PagerDuty**: jahpay.pagerduty.com

---

## 🎉 You're Ready for Production!

All critical security vulnerabilities have been addressed:

- ✅ Blockchain completion/refund implemented
- ✅ Webhook handler with signature verification
- ✅ Fraud detection (velocity, duplicate, replay)
- ✅ Auto-timeout refunds
- ✅ Redis-based rate limiting

**Final Steps:**

1. Complete security audit
2. Load test with 1000 concurrent transactions
3. Run through incident response playbook
4. Get insurance/reserve fund
5. **Launch! 🚀**
