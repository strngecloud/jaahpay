# Jahpay Spending Server

Backend service for Jahpay's crypto-to-naira spending feature. Handles bank API integrations, exchange rates, and blockchain event processing.

## Features

- ✅ Bank API Integration (Wema Alat, Providus, Paystack)
- ✅ Real-time blockchain event listening (Celo, Base)
- ✅ Multi-source exchange rate aggregation
- ✅ Spending limits and KYC management
- ✅ Automatic fallback between bank providers
- ✅ Comprehensive error handling and logging
- ✅ TypeORM with PostgreSQL
- ✅ Professional separation of concerns

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis (for queues)
- pnpm

## Installation

```bash
# From project root
pnpm install

# Or from server directory
cd apps/server
pnpm install
```

## Configuration

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Update the `.env` file with your credentials:

- Database connection
- Blockchain RPC URLs
- Bank API credentials
- Contract addresses

## Database Setup

```bash
# Create database
createdb jahpay_spending

# Run migrations (if you set up migrations)
pnpm run migration:run

# Or let TypeORM sync (development only)
# Set DATABASE_SYNCHRONIZE=true in .env
```

## Running the Server

```bash
# Development
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

## API Endpoints

Base URL: `http://localhost:3001/api/v1`

### Spend Management

#### POST `/spend/initiate`

Initiate a new spend transaction

**Request:**

```json
{
  "userAddress": "0x...",
  "ngnAmount": 5000,
  "recipientAccountNumber": "0123456789",
  "recipientBankCode": "035",
  "narration": "Payment for goods",
  "chain": "celo"
}
```

**Response:**

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

#### GET `/spend/:spendId`

Get spend transaction details

#### GET `/spend?userAddress=0x...&page=1&limit=20`

Get spend history for a user

#### POST `/spend/cancel/:spendId`

Cancel a pending spend

**Request:**

```json
{
  "userAddress": "0x..."
}
```

#### POST `/spend/validate-account`

Validate a bank account before spending

**Request:**

```json
{
  "accountNumber": "0123456789",
  "bankCode": "035"
}
```

### Exchange Rates

#### GET `/rates/current`

Get current USD to NGN exchange rate

**Response:**

```json
{
  "usdToNgn": 1428.57,
  "lastUpdated": "2024-03-15T10:25:00Z",
  "sources": ["binance", "coingecko"]
}
```

## Architecture

### Directory Structure

```
src/
├── bank/                    # Bank API integrations
│   ├── interfaces/          # Bank provider interface
│   ├── providers/           # Individual bank implementations
│   └── bank.service.ts      # Bank service coordinator
├── blockchain/              # Blockchain event listeners
│   └── blockchain.service.ts
├── common/                  # Shared code
│   ├── dto/                 # Data transfer objects
│   ├── exceptions/          # Custom exceptions
│   ├── filters/             # Exception filters
│   └── types/               # TypeScript types
├── database/                # Database entities
│   └── entities/
├── exchange-rate/           # Exchange rate service
├── spend/                   # Spend feature
│   ├── services/            # Business logic
│   ├── spend.controller.ts  # HTTP endpoints
│   └── spend.service.ts     # Main service
└── main.ts                  # Application entry
```

### Services

- **SpendService**: Main spending orchestration
- **SpendProcessorService**: Processes blockchain events
- **SpendLimitService**: Manages user spending limits
- **BankService**: Coordinates bank API calls with fallback
- **ExchangeRateService**: Multi-source rate aggregation
- **BlockchainService**: Listens to contract events

### Error Handling

All errors are caught by the global exception filter and returned in a consistent format:

```json
{
  "statusCode": 400,
  "timestamp": "2024-03-15T10:30:00Z",
  "path": "/api/v1/spend/initiate",
  "method": "POST",
  "error": "SpendLimitExceeded",
  "message": "Daily spending limit exceeded...",
  "details": { ... }
}
```

## Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

## Bank Provider Integration

### Adding a New Provider

1. Create provider class implementing `IBankProvider`:

```typescript
// src/bank/providers/newbank.provider.ts
@Injectable()
export class NewBankProvider implements IBankProvider {
  getProviderName(): string {
    return 'newbank';
  }

  async validateAccount(...): Promise<BankAccountValidation> {
    // Implementation
  }

  async transfer(...): Promise<BankTransferResponse> {
    // Implementation
  }

  // ... other methods
}
```

2. Register in `BankModule` and `BankService`

## Blockchain Event Processing

The server automatically listens for `SpendInitiated` events from the smart contracts and processes them:

1. Event detected → SpendProcessorService
2. Validate in database
3. Execute bank transfer
4. Call contract `completeSpend()` or `refundSpend()`

## Security

- Input validation with class-validator
- Spending limits per user
- KYC level-based limits
- Blacklist support
- Rate limiting
- Secure credential storage
- Audit logging for all bank API calls

## Production Deployment

### Environment Variables

Ensure all production variables are set:

- Bank API production credentials
- Mainnet RPC URLs
- Mainnet contract addresses
- Production database

### Monitoring

- Sentry for error tracking
- DataDog for metrics
- Database query logging
- Bank API call logging

### Scaling

- Horizontal scaling supported
- Stateless design
- Redis for distributed queues
- Database connection pooling

## Troubleshooting

### Event Listener Not Working

1. Check RPC URL is correct
2. Verify contract address is deployed
3. Check contract ABI matches

### Bank API Failing

1. Check credentials in `.env`
2. Verify API is in sandbox/production mode
3. Check logs in `bank_api_logs` table
4. Test with Paystack (most reliable fallback)

### Exchange Rate Issues

1. Check Binance/CoinGecko APIs are accessible
2. Verify rate update cron is running
3. Check logs for rate fetch errors

## License

MIT
