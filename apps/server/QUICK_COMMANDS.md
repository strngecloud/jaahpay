# Quick Commands Reference

## 🚀 Development

```bash
# Install dependencies
npm install

# Start development server (hot reload)
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Run tests
npm run test

# Run linter
npm run lint

# Format code
npm run format
```

---

## 🔧 Setup

```bash
# Install Redis (macOS)
brew install redis
brew services start redis

# Install Redis (Ubuntu)
sudo apt install redis-server
sudo systemctl start redis-server

# Install Redis (Docker)
docker run -d -p 6379:6379 --name redis redis:7-alpine

# Check Redis running
redis-cli ping  # Should return: PONG

# Create PostgreSQL database
createdb jahpay_dev

# Run PostgreSQL (Docker)
docker run -d -p 5432:5432 \
  --name postgres \
  -e POSTGRES_DB=jahpay_dev \
  -e POSTGRES_USER=jahpay \
  -e POSTGRES_PASSWORD=jahpay \
  postgres:15-alpine
```

---

## 🔍 Testing

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test webhook endpoint
curl -X POST http://localhost:3000/webhooks/health

# Validate bank account
curl -X POST http://localhost:3000/api/v1/spend/validate-account \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "0123456789",
    "bankCode": "035"
  }'

# Initiate spend
curl -X POST http://localhost:3000/api/v1/spend/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "ngnAmount": 5000,
    "recipientAccountNumber": "0123456789",
    "recipientBankCode": "035",
    "narration": "Test payment",
    "chain": "celo"
  }'

# Get spend history
curl "http://localhost:3000/api/v1/spend/history?userAddress=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&page=1&limit=20"

# Get specific spend
curl http://localhost:3000/api/v1/spend/1
```

---

## 📊 Database

```bash
# Connect to database
psql jahpay_dev

# List tables
\dt

# Check spends
SELECT * FROM spends LIMIT 10;

# Check webhook logs
SELECT * FROM webhook_logs ORDER BY processed_at DESC LIMIT 10;

# Check ledger entries
SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 10;

# Verify ledger integrity
SELECT
  SUM(debit_amount) as total_debits,
  SUM(credit_amount) as total_credits,
  ABS(SUM(credit_amount) - SUM(debit_amount)) as difference
FROM ledger_entries;

# Count by status
SELECT status, COUNT(*) FROM spends GROUP BY status;
```

---

## 🔐 Redis

```bash
# Connect to Redis
redis-cli

# Check fraud velocity counters
KEYS velocity:*

# Check replay attack nonces
KEYS replay:*

# Check idempotency keys
KEYS webhook:*

# Get specific key
GET replay:0x1234...

# List length (velocity counter)
LLEN velocity:hour:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

# Clear all Redis data (DANGEROUS!)
FLUSHALL
```

---

## ⛓️ Blockchain

```bash
# Check processor wallet balance (Celo)
cast balance $PROCESSOR_WALLET_ADDRESS --rpc-url https://forno.celo.org

# Get spend details from contract
cast call $SPEND_ROUTER_ADDRESS \
  "getSpend(uint256)(tuple)" \
  1 \
  --rpc-url https://forno.celo.org

# Check if wallet is authorized processor
cast call $SPEND_ROUTER_ADDRESS \
  "authorizedProcessors(address)(bool)" \
  $PROCESSOR_WALLET_ADDRESS \
  --rpc-url https://forno.celo.org

# Authorize processor (owner only)
cast send $SPEND_ROUTER_ADDRESS \
  "authorizeProcessor(address)" \
  $PROCESSOR_WALLET_ADDRESS \
  --rpc-url https://forno.celo.org \
  --private-key $OWNER_PRIVATE_KEY

# Pause contract (emergency)
cast send $SPEND_ROUTER_ADDRESS "pause()" \
  --rpc-url https://forno.celo.org \
  --private-key $OWNER_PRIVATE_KEY

# Unpause contract
cast send $SPEND_ROUTER_ADDRESS "unpause()" \
  --rpc-url https://forno.celo.org \
  --private-key $OWNER_PRIVATE_KEY
```

---

## 📝 Logs

```bash
# Tail application logs
tail -f logs/app.log

# Search for errors
grep "ERROR" logs/app.log

# Search for specific spend
grep "spendId: 1" logs/app.log

# Watch real-time (if using PM2)
pm2 logs jahpay-server

# PM2 restart
pm2 restart jahpay-server

# PM2 stop
pm2 stop jahpay-server

# PM2 status
pm2 status
```

---

## 🔄 Deployment

```bash
# Build Docker image
docker build -t jahpay-server .

# Run Docker container
docker run -d \
  -p 3000:3000 \
  --name jahpay-server \
  --env-file .env.production \
  jahpay-server

# Check container logs
docker logs -f jahpay-server

# Execute command in container
docker exec -it jahpay-server sh

# Stop container
docker stop jahpay-server

# Remove container
docker rm jahpay-server
```

---

## 🧪 Testing Fraud Detection

```bash
# Test velocity limit (send 3 requests quickly)
for i in {1..3}; do
  curl -X POST http://localhost:3000/api/v1/spend/initiate \
    -H "Content-Type: application/json" \
    -d '{
      "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "ngnAmount": 5000,
      "recipientAccountNumber": "0123456789",
      "recipientBankCode": "035",
      "narration": "Test '$i'",
      "chain": "celo"
    }'
  echo ""
done
# Third request should be blocked

# Test duplicate detection (same amount/recipient twice)
curl -X POST http://localhost:3000/api/v1/spend/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "ngnAmount": 5000,
    "recipientAccountNumber": "0123456789",
    "recipientBankCode": "035",
    "narration": "Duplicate test",
    "chain": "celo"
  }'

# Wait 1 second and send again - should be blocked
sleep 1
curl -X POST http://localhost:3000/api/v1/spend/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "ngnAmount": 5000,
    "recipientAccountNumber": "0123456789",
    "recipientBankCode": "035",
    "narration": "Duplicate test",
    "chain": "celo"
  }'
```

---

## 🛠️ Troubleshooting

```bash
# Check if Redis is running
redis-cli ping

# Check if PostgreSQL is running
pg_isready

# Check server is running
curl http://localhost:3000/health

# Check environment variables loaded
node -e "require('dotenv').config(); console.log(process.env.REDIS_URL)"

# Test Redis connection from Node
node -e "const Redis = require('ioredis'); const redis = new Redis('redis://localhost:6379'); redis.ping().then(console.log)"

# Test database connection
node -e "const { Client } = require('pg'); const client = new Client({host:'localhost',database:'jahpay_dev',user:'jahpay',password:'jahpay'}); client.connect().then(()=>console.log('Connected!')).catch(console.error)"

# Check TypeScript compilation
npm run build

# Check for port conflicts
lsof -i :3000

# Kill process on port 3000
kill -9 $(lsof -t -i:3000)
```

---

## 📈 Performance Testing

```bash
# Install Apache Bench
sudo apt install apache2-utils  # Ubuntu
brew install apache2  # macOS

# Load test health endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 http://localhost:3000/health

# Load test with POST data
ab -n 100 -c 10 -p payload.json -T application/json \
  http://localhost:3000/api/v1/spend/validate-account

# Using curl with time measurement
time curl http://localhost:3000/health
```

---

## 🔍 Monitoring

```bash
# Check processor wallet balance
cast balance $PROCESSOR_WALLET --rpc-url https://forno.celo.org

# Check server memory usage
ps aux | grep node

# Check disk space
df -h

# Check Redis memory
redis-cli INFO memory

# Check PostgreSQL connections
psql jahpay_dev -c "SELECT count(*) FROM pg_stat_activity;"

# Watch system resources
htop

# Watch network connections
netstat -an | grep 3000
```

---

## 🚨 Emergency Commands

```bash
# Pause contract immediately
cast send $SPEND_ROUTER "pause()" \
  --rpc-url https://forno.celo.org \
  --private-key $OWNER_KEY

# Revoke compromised processor wallet
cast send $SPEND_ROUTER \
  "revokeProcessor(address)" \
  $COMPROMISED_WALLET \
  --rpc-url https://forno.celo.org \
  --private-key $OWNER_KEY

# Stop server immediately
pm2 stop jahpay-server
# or
pkill -f "node.*main.js"

# Clear Redis (reset all rate limits/nonces)
redis-cli FLUSHALL

# Backup database NOW
pg_dump jahpay_dev > emergency_backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 📚 Quick Links

- Health: http://localhost:3000/health
- API Base: http://localhost:3000/api/v1
- Webhooks: http://localhost:3000/webhooks

**Documentation:**

- Setup: `SETUP_INSTRUCTIONS.md`
- Deployment: `PRODUCTION_DEPLOYMENT.md`
- Security: `SECURITY_AUDIT_CHECKLIST.md`
- Summary: `IMPLEMENTATION_SUMMARY.md`
