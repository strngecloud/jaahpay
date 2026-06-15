# Quick Setup Instructions

## Installation & Local Development

### 1. Install Dependencies

```bash
cd apps/server
npm install
```

### 2. Install Redis (Required for Fraud Detection)

**macOS:**

```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

**Docker:**

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### 3. Setup PostgreSQL Database

```bash
# Create database
createdb jahpay_dev

# Or with Docker
docker run -d \
  -p 5432:5432 \
  -e POSTGRES_DB=jahpay_dev \
  -e POSTGRES_USER=jahpay \
  -e POSTGRES_PASSWORD=jahpay \
  postgres:15-alpine
```

### 4. Configure Environment Variables

Copy the `.env` file and update with your values:

```bash
# Required for development:
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=jahpay
DATABASE_PASSWORD=jahpay
DATABASE_NAME=jahpay_dev
DATABASE_SYNCHRONIZE=true  # Auto-create tables
REDIS_URL=redis://localhost:6379

# Get from Wema Bank developer portal:
WEMA_API_URL=https://wema-alatdev-apimgt.developer.azure-api.net/apis
WEMA_API_KEY=your_key
WEMA_SALT_KEY=your_salt

# Create a test wallet for processor:
PROCESSOR_WALLET_PRIVATE_KEY=0x...

# SpendRouter contract addresses (after deploying to testnet):
SPEND_ROUTER_ADDRESS_CELO=0x...
```

### 5. Deploy Contracts to Testnet (First Time Only)

```bash
cd ../contracts

# Deploy to Celo Alfajores testnet
forge script script/Deploy.s.sol \
  --rpc-url https://alfajores-forno.celo-testnet.org \
  --broadcast

# Copy the SpendRouter address to .env
```

### 6. Authorize Processor Wallet

```bash
# Using cast (Foundry)
cast send $SPEND_ROUTER_ADDRESS \
  "authorizeProcessor(address)" \
  $PROCESSOR_WALLET_ADDRESS \
  --rpc-url https://alfajores-forno.celo-testnet.org \
  --private-key $OWNER_PRIVATE_KEY
```

### 7. Start the Server

```bash
cd ../server
npm run start:dev
```

Server will start on http://localhost:3000

### 8. Verify Everything Works

```bash
# Check health
curl http://localhost:3000/health

# Check Redis connection
redis-cli ping
# Should return: PONG

# Check database tables created
psql jahpay_dev -c "\dt"
# Should show: spends, webhook_logs, bank_api_logs, user_spend_limits

# Check blockchain listener started
# Look for logs:
# "Starting Celo event listener at 0x..."
# "Processor wallet: 0x..."
```

---

## Testing the Full Flow

### 1. Validate Bank Account

```bash
curl -X POST http://localhost:3000/api/v1/spend/validate-account \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "0123456789",
    "bankCode": "035"
  }'
```

### 2. Initiate Spend (Backend)

```bash
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
```

Expected response:

```json
{
  "success": true,
  "data": {
    "spendId": "temp-...",
    "usdcAmount": 3.5,
    "exchangeRate": 1428.57,
    "platformFee": 0.0105,
    "totalUSDCRequired": 3.5105,
    "recipientAccountName": "John Doe",
    "estimatedCompletionTime": "2-5 minutes"
  }
}
```

### 3. Complete on Blockchain (Frontend would do this)

```typescript
// In your frontend:
import { parseEther, keccak256, toBytes } from 'viem';

const recipientHash = keccak256(toBytes(`${accountNumber}-${bankCode}`));

const tx = await walletClient.writeContract({
  address: SPEND_ROUTER_ADDRESS,
  abi: SPEND_ROUTER_ABI,
  functionName: 'initiateSpend',
  args: [
    parseUnits(usdcAmount.toString(), 6), // USDC has 6 decimals
    parseUnits(ngnAmount.toString(), 2), // NGN in kobo
    recipientHash,
  ],
});

// Wait for transaction
const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
const spendId = receipt.logs[0].args.spendId;
```

### 4. Watch Backend Process Transaction

The backend will automatically:

1. Detect `SpendInitiated` event from blockchain
2. Run fraud checks
3. Execute bank transfer via Wema/Paystack
4. Call `completeSpend()` on blockchain when bank confirms
5. USDC released to fee collector

Check logs:

```bash
tail -f logs/app.log

# Expected logs:
# "SpendInitiated event detected on celo: 1"
# "Processing spend initiated: 1"
# "Executing bank transfer for spend: 1"
# "Bank transfer completed for spend: 1"
# "Completing spend 1 on celo"
# "Spend 1 completed successfully on-chain"
```

---

## Troubleshooting

### "Redis connection error"

```bash
# Check Redis is running
redis-cli ping

# If not, start it:
brew services start redis
# or
sudo systemctl start redis-server
```

### "Database connection error"

```bash
# Check PostgreSQL is running
pg_isready

# Check database exists
psql -l | grep jahpay_dev
```

### "Processor wallet not initialized"

```bash
# Make sure you set PROCESSOR_WALLET_PRIVATE_KEY in .env
# Generate one with:
cast wallet new
```

### "SPEND_ROUTER_ADDRESS not configured"

```bash
# Deploy contract first:
cd apps/contracts
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast

# Copy address to .env
```

### "Webhook signature verification failed"

```bash
# Make sure WEMA_SALT_KEY is correct in .env
# Test webhook locally:
curl -X POST http://localhost:3000/webhooks/health
```

---

## Development Commands

```bash
# Start dev server with hot reload
npm run start:dev

# Run linter
npm run lint

# Format code
npm run format

# Run tests (when available)
npm run test

# Build for production
npm run build

# Start production build
npm run start:prod
```

---

## Next Steps

1. ✅ Complete local setup
2. ✅ Test full flow end-to-end
3. ✅ Read `PRODUCTION_DEPLOYMENT.md` before launching
4. ✅ Run security audit
5. ✅ Load test with 1000 concurrent transactions

---

## Need Help?

- Check logs: `tail -f logs/app.log`
- Review `PAYMENT_FLOW_ANALYSIS.md` for architecture details
- Review `PRODUCTION_DEPLOYMENT.md` for deployment guide
- Contact: backend@jahpay.com
