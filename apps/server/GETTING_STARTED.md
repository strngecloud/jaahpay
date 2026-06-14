# Getting Started with Jahpay Spending Server

This guide will help you set up and run the Jahpay spending server locally.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20 or higher ([Download](https://nodejs.org/))
- **pnpm** 8 or higher (`npm install -g pnpm`)
- **Docker** and **Docker Compose** ([Download](https://www.docker.com/))
- **Git** ([Download](https://git-scm.com/))

## Quick Start (5 minutes)

### 1. Navigate to Server Directory

```bash
cd apps/server
```

### 2. Run Setup Script

```bash
./scripts/setup.sh
```

This script will:

- Create `.env` file from `.env.example`
- Start PostgreSQL and Redis via Docker
- Install all dependencies

### 3. Configure Environment

Edit the `.env` file with your credentials:

```bash
nano .env  # or use your preferred editor
```

**Minimum required configuration for local development:**

```env
# Server
NODE_ENV=development
PORT=3001

# Database (already configured by Docker)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=jahpay_spending
DATABASE_SYNCHRONIZE=true  # Set to false in production
DATABASE_LOGGING=true

# Redis (already configured by Docker)
REDIS_HOST=localhost
REDIS_PORT=6379

# Blockchain (use testnets for development)
CELO_RPC_URL=https://alfajores-forno.celo-testnet.org
BASE_RPC_URL=https://sepolia.base.org

# Contract addresses (update after deploying contracts)
SPEND_ROUTER_ADDRESS_CELO=0x0000000000000000000000000000000000000000
SPEND_ROUTER_ADDRESS_BASE=0x0000000000000000000000000000000000000000

# Bank APIs (optional for initial setup - see below)
WEMA_API_URL=https://wema-alatdev-apimgt.developer.azure-api.net/apis
WEMA_CLIENT_ID=your_client_id
WEMA_CLIENT_SECRET=your_client_secret
WEMA_API_KEY=your_api_key

PAYSTACK_API_URL=https://api.paystack.co
PAYSTACK_SECRET_KEY=sk_test_...  # Get from paystack.com

# Exchange rates
BINANCE_API_URL=https://api.binance.com
COINGECKO_API_URL=https://api.coingecko.com/api/v3
```

### 4. Start the Server

```bash
pnpm run start:dev
```

You should see:

```
🚀 Server is running on: http://localhost:3001/api/v1
📊 Environment: development
💾 Database: jahpay_spending
```

### 5. Verify Installation

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:3001/api/v1/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-03-15T10:30:00.000Z",
  "environment": "development",
  "version": "1.0.0"
}
```

## Bank API Setup

To enable actual bank transfers, you need to register for bank API access:

### Paystack (Easiest - Recommended for testing)

1. Visit [paystack.com](https://paystack.com)
2. Create an account
3. Go to Settings → API Keys & Webhooks
4. Copy your **Test Secret Key** (starts with `sk_test_`)
5. Add to `.env`:
   ```env
   PAYSTACK_SECRET_KEY=sk_test_your_key_here
   ```

### Wema Bank Alat

1. Visit [Wema Alat Developer Portal](https://wema-alatdev-apimgt.developer.azure-api.net/)
2. Register for an account
3. Subscribe to the API products
4. Get your credentials (Client ID, Secret, API Key)
5. Add to `.env`

### Providus Bank

1. Contact Providus Bank for API access
2. Fill out their API request form
3. Receive credentials
4. Add to `.env`

## Testing the API

### 1. Get Current Exchange Rate

```bash
curl http://localhost:3001/api/v1/rates/current
```

### 2. Validate a Bank Account

```bash
curl -X POST http://localhost:3001/api/v1/spend/validate-account \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "0123456789",
    "bankCode": "058"
  }'
```

### 3. Initiate a Spend

```bash
curl -X POST http://localhost:3001/api/v1/spend/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "ngnAmount": 5000,
    "recipientAccountNumber": "0123456789",
    "recipientBankCode": "058",
    "narration": "Test payment",
    "chain": "celo"
  }'
```

### 4. Get Spend History

```bash
curl "http://localhost:3001/api/v1/spend?userAddress=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&page=1&limit=10"
```

## Project Structure

```
apps/server/
├── src/
│   ├── bank/                 # Bank API integrations
│   │   ├── interfaces/       # IBankProvider interface
│   │   ├── providers/        # Wema, Paystack implementations
│   │   └── bank.service.ts   # Coordinator with fallback
│   ├── blockchain/           # Event listeners
│   │   └── blockchain.service.ts
│   ├── common/               # Shared code
│   │   ├── dto/              # Request/response DTOs
│   │   ├── exceptions/       # Custom exceptions
│   │   ├── filters/          # Global error handler
│   │   └── types/            # TypeScript types
│   ├── database/             # Database layer
│   │   ├── entities/         # TypeORM entities
│   │   └── migrations/       # SQL migrations
│   ├── exchange-rate/        # Exchange rate service
│   ├── health/               # Health check endpoint
│   ├── spend/                # Main spending feature
│   │   ├── services/         # Business logic
│   │   ├── spend.controller.ts
│   │   └── spend.service.ts
│   ├── app.module.ts         # Main app module
│   └── main.ts               # Entry point
├── scripts/
│   └── setup.sh              # Setup script
├── .env.example              # Environment template
├── docker-compose.yml        # Local services
├── package.json
└── README.md
```

## Development Workflow

### Watch Mode

The server runs in watch mode by default with `start:dev`:

```bash
pnpm run start:dev
```

Any file changes will automatically restart the server.

### Database Changes

If you modify entities, TypeORM will auto-sync in development (if `DATABASE_SYNCHRONIZE=true`).

For production, use migrations:

```bash
# Create migration
pnpm run migration:create src/database/migrations/MyMigration

# Run migrations
pnpm run migration:run

# Revert migration
pnpm run migration:revert
```

### Logs

The server uses NestJS logger. Set log level in `.env`:

```env
LOG_LEVEL=debug  # error, warn, log, debug, verbose
```

### Database Management

**View data with pgAdmin:**

```bash
docker-compose --profile tools up -d pgadmin
```

Open http://localhost:5050

- Email: `admin@jahpay.local`
- Password: `admin`

**Direct PostgreSQL access:**

```bash
docker-compose exec postgres psql -U postgres -d jahpay_spending
```

## Troubleshooting

### Port Already in Use

If port 3001 is taken:

```bash
# Change in .env
PORT=3002
```

### Database Connection Failed

Check Docker services are running:

```bash
docker-compose ps
```

Restart if needed:

```bash
docker-compose restart postgres
```

### Exchange Rate Not Updating

The exchange rate updates every minute via cron job. Check logs:

```bash
# Look for "Updating exchange rate..." in logs
```

### Bank API Errors

1. Check your API keys in `.env`
2. Verify your account is active
3. Check the `bank_api_logs` table for detailed error messages

```sql
SELECT * FROM bank_api_logs ORDER BY created_at DESC LIMIT 10;
```

### Event Listener Not Working

1. Verify contract address is correct in `.env`
2. Check RPC URL is accessible
3. Ensure contract is deployed on the network

## Environment Variables Reference

| Variable                    | Required | Default         | Description                         |
| --------------------------- | -------- | --------------- | ----------------------------------- |
| `NODE_ENV`                  | Yes      | development     | Environment: development/production |
| `PORT`                      | No       | 3001            | Server port                         |
| `DATABASE_HOST`             | Yes      | localhost       | PostgreSQL host                     |
| `DATABASE_PORT`             | Yes      | 5432            | PostgreSQL port                     |
| `DATABASE_USERNAME`         | Yes      | postgres        | Database user                       |
| `DATABASE_PASSWORD`         | Yes      | postgres        | Database password                   |
| `DATABASE_NAME`             | Yes      | jahpay_spending | Database name                       |
| `CELO_RPC_URL`              | Yes      | -               | Celo RPC endpoint                   |
| `BASE_RPC_URL`              | Yes      | -               | Base RPC endpoint                   |
| `SPEND_ROUTER_ADDRESS_CELO` | Yes      | -               | SpendRouter contract on Celo        |
| `SPEND_ROUTER_ADDRESS_BASE` | Yes      | -               | SpendRouter contract on Base        |
| `WEMA_API_URL`              | No       | -               | Wema Alat API URL                   |
| `WEMA_CLIENT_ID`            | No       | -               | Wema client ID                      |
| `PAYSTACK_SECRET_KEY`       | No       | -               | Paystack secret key                 |

## Next Steps

1. **Deploy Smart Contracts**: See `../contracts/README.md` for contract deployment
2. **Frontend Integration**: Connect your web app to this backend
3. **Add More Banks**: Implement additional providers in `src/bank/providers/`
4. **Setup Monitoring**: Configure Sentry, DataDog for production
5. **CI/CD**: Setup automated deployments

## Need Help?

- Check the [main README](./README.md) for detailed API documentation
- Review the [implementation plan](../../SPENDING_FEATURE.md)
- Open an issue on GitHub

## Production Checklist

Before deploying to production:

- [ ] Set `DATABASE_SYNCHRONIZE=false`
- [ ] Use production bank API credentials
- [ ] Configure mainnet RPC URLs
- [ ] Deploy contracts to mainnet
- [ ] Setup proper secrets management
- [ ] Enable SSL/TLS
- [ ] Configure CORS properly
- [ ] Setup monitoring and alerts
- [ ] Run security audit
- [ ] Setup database backups
- [ ] Configure rate limiting
- [ ] Test failure scenarios

Happy coding! 🚀
