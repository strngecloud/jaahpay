# Jahpay Spending Server - Architecture

## Overview

Professional NestJS backend service for the Jahpay spending feature, enabling users to spend crypto (USDC) as easily as Naira through Nigerian bank APIs.

## Architecture Principles

### 1. Separation of Concerns

- **Controllers**: HTTP request/response handling
- **Services**: Business logic
- **Providers**: External API integrations
- **Entities**: Database models
- **DTOs**: Data validation and transformation

### 2. Dependency Injection

- All services use NestJS DI container
- Easy testing and mocking
- Loose coupling between modules

### 3. Error Handling

- Custom exceptions for domain errors
- Global exception filter for consistent responses
- Detailed error logging

### 4. Type Safety

- Full TypeScript coverage
- Strict null checks
- Interface-driven design

## Core Modules

### Spend Module

**Purpose**: Main spending feature orchestration

**Components**:

- `SpendController`: HTTP endpoints
- `SpendService`: Coordinates spending workflow
- `SpendProcessorService`: Processes blockchain events
- `SpendLimitService`: Manages user limits and KYC

**Flow**:

1. User initiates spend via API
2. Validate account and check limits
3. Calculate USDC amount from NGN
4. Create pending spend record
5. Frontend executes blockchain transaction
6. Event listener picks up `SpendInitiated`
7. Execute bank transfer
8. Update blockchain (complete/refund)

### Bank Module

**Purpose**: Bank API integration with automatic fallback

**Components**:

- `BankService`: Coordinator with provider fallback
- `WemaProvider`: Wema Alat API integration
- `PaystackProvider`: Paystack API integration
- `IBankProvider`: Interface all providers implement

**Features**:

- Automatic fallback between providers
- Comprehensive API logging
- Retry logic
- Health checks

**Adding New Provider**:

```typescript
@Injectable()
export class NewProvider implements IBankProvider {
  getProviderName(): string { return 'newbank'; }
  async validateAccount(...): Promise<BankAccountValidation> { }
  async transfer(...): Promise<BankTransferResponse> { }
  async getTransferStatus(...): Promise<BankTransferResponse> { }
  async isAvailable(): Promise<boolean> { }
}
```

### Blockchain Module

**Purpose**: Listen to smart contract events

**Components**:

- `BlockchainService`: Event listener using viem

**Features**:

- Watches both Celo and Base chains
- Processes `SpendInitiated`, `SpendCompleted`, `SpendRefunded`
- Automatic reconnection on errors
- Multi-chain support

### Exchange Rate Module

**Purpose**: Reliable, manipulation-resistant exchange rates

**Components**:

- `ExchangeRateService`: Aggregates multiple sources
- `ExchangeRateController`: Public API endpoints

**Features**:

- Multi-source aggregation (Binance, CoinGecko)
- Median calculation to prevent outliers
- Deviation checks (max 5%)
- Auto-update every minute via cron
- Staleness detection

**Rate Sources Priority**:

1. Binance (highest reliability)
2. CoinGecko (backup)
3. Add more as needed

## Data Flow

### Spend Initiation

```
Frontend
    ↓ POST /spend/initiate
SpendController
    ↓ DTO validation
SpendService
    ↓ validateAccount()
BankService → BankProvider (Wema/Paystack)
    ↓
SpendService
    ↓ getCurrentRate()
ExchangeRateService
    ↓
SpendService
    ↓ checkSpendLimit()
SpendLimitService
    ↓
SpendService
    ↓ Create SpendEntity
Database (pending)
    ↓
Frontend (receives spendId, amount)
    ↓ User signs blockchain tx
Blockchain (SpendRouter.sol)
    ↓ emit SpendInitiated
BlockchainService (listener)
    ↓ handleSpendInitiated()
SpendProcessorService
    ↓ processSpendInitiated()
    ↓ executeBankTransfer()
BankService → BankProvider
    ↓ transfer successful
SpendProcessorService
    ↓ update status to COMPLETED
Database
    ↓ TODO: completeSpend()
Blockchain (mark complete on-chain)
```

### Bank Transfer Fallback

```
BankService.transfer()
    ↓
Try Provider 1 (Wema)
    ├─ Success? → Return result
    └─ Failed → Log error
Try Provider 2 (Paystack)
    ├─ Success? → Return result
    └─ Failed → Log error
All failed → Throw BankApiException
    ↓
SpendProcessorService
    ↓ markSpendAsFailed()
    ↓ TODO: refundSpend()
Blockchain (refund user)
```

## Database Schema

### spends

- Primary transaction records
- Status tracking
- Indexed on user_address, status, created_at

### bank_api_logs

- Audit trail for all bank API calls
- Request/response logging
- Performance tracking
- Debugging aid

### user_spend_limits

- Per-user spending limits
- KYC level tracking
- Blacklist management
- Auto-reset daily/monthly

## Security

### Input Validation

- class-validator on all DTOs
- Whitelist unknown properties
- Transform and sanitize inputs

### Spending Limits

- Daily limits: $100 (basic) to $2,000 (full KYC)
- Monthly limits: $1,000 to $20,000
- Automatic reset
- Blacklist support

### Error Handling

- Never expose internal errors to clients
- Log sensitive errors securely
- Return generic messages

### API Security

- Rate limiting (100 req/min)
- CORS configuration
- Input sanitization
- SQL injection prevention (TypeORM)

## Configuration

### Environment-based

- Development: `.env.local` or `.env`
- Production: Environment variables
- Secrets: Use secret manager (AWS, Vault)

### ConfigService

- Global configuration injection
- Type-safe access
- Validation on startup

## Testing Strategy

### Unit Tests

- Services in isolation
- Mock all dependencies
- Test business logic

### Integration Tests

- Module testing
- Database integration
- API endpoint testing

### E2E Tests

- Full workflow testing
- Database + API
- Realistic scenarios

## Monitoring & Logging

### Logging

- NestJS Logger
- Log levels: error, warn, log, debug, verbose
- Structured logging

### Metrics

- API response times
- Bank API success rates
- Exchange rate updates
- Database queries

### Alerts

- Failed bank transfers
- Exchange rate stale
- Database connection errors
- High error rates

## Performance

### Database

- Indexed queries
- Connection pooling
- Query optimization

### Caching

- Redis for rate limiting
- Exchange rate caching
- Session storage

### Async Processing

- BullMQ for job queues
- Background tasks
- Retry mechanisms

## Scalability

### Horizontal Scaling

- Stateless design
- No in-memory session storage
- Load balancer ready

### Database

- Read replicas for queries
- Write master for transactions
- Connection pooling

### Blockchain Listeners

- Single instance per chain
- Idempotent event processing
- Duplicate detection

## Deployment

### Docker

- Multi-stage builds
- Minimal base images
- Health checks

### Environment

- Development: Local Docker
- Staging: Cloud preview
- Production: Cloud production

### CI/CD

- Automated testing
- Linting and formatting
- Security scanning
- Automated deployments

## Future Enhancements

### Phase 1 ✅

- Bank API integration
- Exchange rates
- Spending limits
- Event listening

### Phase 2 (Planned)

- KYC verification
- Admin dashboard
- Analytics
- Webhooks for clients

### Phase 3 (Planned)

- Multiple stablecoins
- Card issuance
- Merchant payments
- Rewards program

## Code Quality

### Standards

- ESLint for linting
- Prettier for formatting
- Husky for git hooks
- Conventional commits

### Documentation

- README per module
- API documentation
- Architecture docs
- Code comments

### Reviews

- Pull request reviews
- Code quality checks
- Security reviews
- Performance audits

---

Built with ❤️ using NestJS
