# Jahpay Spending Feature - Complete Implementation Plan

## Overview

Enable users to spend crypto (USDC/USDT) as easily as naira through integration with Nigerian banking APIs (Wema Alat, Providus). Users can shop anywhere, pay bills, and transfer money while their wallet balance remains in stablecoins.

**Target Experience**: Crypto wallet that feels like a traditional Nigerian bank account.

---

## Architecture Flow

### High-Level Flow

```
User initiates spend → SpendRouter.sol → User approves USDC →
SpendRouter deducts & locks USDC → Emit SpendInitiated event →
Backend listener catches event → Backend calls Bank API →
Bank sends Naira to recipient → Backend confirms →
Emit SpendCompleted event → Release or refund on chain
```

### Detailed Transaction Flow

#### 1. **User Initiates Spend** (Frontend)

- User enters:
  - Recipient bank details (account number, bank code)
  - Amount in NGN (Naira)
  - Description/narration
- Frontend calculates USDC equivalent using real-time NGN/USD rate
- Frontend displays: Amount in NGN, USDC to be deducted, fees, exchange rate

#### 2. **On-Chain Transaction** (SpendRouter.sol)

- User approves USDC spending
- Contract deducts USDC from user wallet
- USDC held in escrow within SpendRouter
- Contract emits `SpendInitiated` event with:
  - `spendId` (unique identifier)
  - `user` (wallet address)
  - `usdcAmount` (amount deducted)
  - `ngnAmount` (expected NGN to send)
  - `recipientDetails` (encrypted hash)
  - `timestamp`

#### 3. **Backend Processing** (Server Listener)

- Event listener catches `SpendInitiated` event
- Retrieves recipient details from database (mapped by spendId)
- Validates transaction hasn't been processed
- Calls Nigerian bank API to initiate transfer
- Bank API processes naira transfer to recipient

#### 4. **Transaction Completion**

**Success Case:**

- Bank confirms transfer successful
- Backend calls `completeSpend(spendId)` on SpendRouter
- Contract emits `SpendCompleted` event
- USDC moved to fee collector (minus platform fee)

**Failure Case:**

- Bank transfer fails or times out
- Backend calls `refundSpend(spendId)` on SpendRouter
- Contract refunds USDC to user
- Emit `SpendRefunded` event

---

## Smart Contracts Architecture

### 1. **SpendRouter.sol** (Main Spending Contract)

**Key Features:**

- Escrow management for pending spends
- Multi-signature for large transactions
- Automated refund mechanism
- Rate limiting per user
- Emergency pause functionality

**State Variables:**

```solidity
struct Spend {
    address user;
    uint256 usdcAmount;
    uint256 ngnAmount;
    uint256 timestamp;
    SpendStatus status; // Pending, Completed, Refunded, Cancelled
    bytes32 recipientHash; // Encrypted recipient details
}

mapping(uint256 => Spend) public spends;
mapping(address => uint256) public userDailySpent;
mapping(address => bool) public authorizedProcessors; // Backend wallets
```

**Core Functions:**

- `initiateSpend()` - User initiates spending
- `completeSpend()` - Backend confirms successful bank transfer
- `refundSpend()` - Refund user if bank transfer fails
- `cancelSpend()` - User cancels before processing
- `emergencyPause()` - Admin emergency stop

**Events:**

```solidity
event SpendInitiated(uint256 indexed spendId, address indexed user, uint256 usdcAmount, uint256 ngnAmount);
event SpendCompleted(uint256 indexed spendId, string bankTransactionRef);
event SpendRefunded(uint256 indexed spendId, string reason);
event SpendCancelled(uint256 indexed spendId);
```

### 2. **SpendRateLimiter.sol** (Security Contract)

**Features:**

- Daily spending limits per user
- Velocity checks (max transactions per hour)
- Whitelist for trusted users (higher limits)
- Blacklist for suspicious addresses

**Functions:**

- `checkSpendLimit()` - Validate spending is within limits
- `setUserLimit()` - Admin sets custom user limits
- `reportSuspiciousActivity()` - Auto-blacklist suspicious patterns

### 3. **SpendOracle.sol** (Exchange Rate Oracle)

**Features:**

- Multiple exchange rate sources (Chainlink, Binance API, local rate providers)
- Fallback mechanism if primary source fails
- Rate deviation checks (prevent manipulation)
- Admin-controlled rate updates

**Functions:**

- `getUSDCToNGNRate()` - Get current exchange rate
- `updateRate()` - Admin/keeper updates rate
- `validateRate()` - Check rate is within acceptable bounds

---

## Backend Service Architecture

### Components

#### 1. **Event Listener Service** (Node.js/TypeScript)

```typescript
// Listen to blockchain events
const listener = new EventListener({
  contract: SpendRouterAddress,
  events: ["SpendInitiated", "SpendCancelled"],
  chains: ["celo", "base"],
});

listener.on("SpendInitiated", async (event) => {
  await processBankTransfer(event);
});
```

#### 2. **Bank API Integration Service**

- Handles communication with Nigerian bank APIs
- Implements retry logic and error handling
- Manages API credentials securely
- Logs all API calls for audit trail

#### 3. **Transaction Manager**

- Tracks spend lifecycle
- Implements timeout mechanism (auto-refund after 15 minutes)
- Handles concurrent requests
- Queue management for high volume

#### 4. **Webhook Handler**

- Receives bank transfer status callbacks
- Updates transaction status in database
- Triggers on-chain completion/refund

---

## Nigerian Banking APIs Integration

### Recommended APIs

#### 1. **Wema Bank Alat API**

**Endpoint**: https://wema-alatdev-apimgt.developer.azure-api.net/apis

**Key Features:**

- Account validation
- Instant transfers (NIP)
- Balance inquiry
- Transaction status check

**Required Endpoints:**

- `POST /transfer/single` - Initiate single transfer
- `GET /transfer/status/{reference}` - Check transfer status
- `POST /account/validate` - Validate account number

**Authentication**: OAuth 2.0 Bearer Token

**Rate Limits**: ~1000 requests/hour (check current limits)

#### 2. **Providus Bank API**

**Endpoint**: https://www.providusbank.com/banking-apis

**Key Features:**

- Dynamic account creation
- Real-time transfers
- Transaction webhooks
- Settlement reports

**Required Endpoints:**

- `POST /api/v1/transfer` - Send money
- `POST /api/v1/account/inquiry` - Account lookup
- `POST /api/v1/balance` - Check balance

**Authentication**: API Key + HMAC Signature

#### 3. **Additional Providers (Recommended)**

**Paystack** (Fallback Option)

- API: https://paystack.com/docs/api/
- Features: Transfers API, supports all Nigerian banks
- More developer-friendly, good documentation
- `POST /transferrecipient` - Create recipient
- `POST /transfer` - Initiate transfer

**Flutterwave** (Alternative)

- API: https://developer.flutterwave.com/docs/
- Features: Bank transfers, USSD, mobile money
- Supports multi-currency
- `POST /transfers` - Send money

---

## Database Schema

### Tables

#### 1. **spends**

```sql
CREATE TABLE spends (
  id BIGSERIAL PRIMARY KEY,
  spend_id VARCHAR(66) UNIQUE NOT NULL, -- On-chain spendId
  user_address VARCHAR(42) NOT NULL,
  chain VARCHAR(20) NOT NULL, -- 'celo' or 'base'

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
  status VARCHAR(20) NOT NULL, -- pending, processing, completed, refunded, failed
  bank_reference VARCHAR(100), -- Bank transaction reference
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Indexes
  INDEX idx_user_address (user_address),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

#### 2. **bank_api_logs**

```sql
CREATE TABLE bank_api_logs (
  id BIGSERIAL PRIMARY KEY,
  spend_id VARCHAR(66) NOT NULL,
  api_provider VARCHAR(50) NOT NULL, -- 'wema', 'providus', 'paystack'
  endpoint VARCHAR(255) NOT NULL,
  request_payload JSON NOT NULL,
  response_payload JSON,
  status_code INT,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. **user_spend_limits**

```sql
CREATE TABLE user_spend_limits (
  user_address VARCHAR(42) PRIMARY KEY,
  daily_limit_usdc DECIMAL(20, 6) DEFAULT 100.00,
  monthly_limit_usdc DECIMAL(20, 6) DEFAULT 1000.00,
  is_verified BOOLEAN DEFAULT FALSE,
  kyc_level INT DEFAULT 1, -- 1: Basic, 2: Intermediate, 3: Full
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints (Backend)

### REST API

#### 1. **POST /api/spend/initiate**

**Request:**

```json
{
  "userAddress": "0x...",
  "ngnAmount": 5000,
  "recipientAccountNumber": "0123456789",
  "recipientBankCode": "035",
  "narration": "Payment for goods"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "spendId": "0x...",
    "usdcAmount": 3.5,
    "exchangeRate": 1428.57,
    "platformFee": 0.0105,
    "totalUSDCRequired": 3.5105,
    "recipientAccountName": "John Doe",
    "estimatedCompletionTime": "2-5 minutes"
  }
}
```

#### 2. **GET /api/spend/:spendId**

**Response:**

```json
{
  "spendId": "0x...",
  "status": "completed",
  "ngnAmount": 5000,
  "usdcAmount": 3.5,
  "recipient": {
    "accountName": "John Doe",
    "accountNumber": "0123456789",
    "bank": "Wema Bank"
  },
  "bankReference": "FT23456789",
  "completedAt": "2024-03-15T10:30:00Z"
}
```

#### 3. **GET /api/spend/history**

**Query Params:** `?userAddress=0x...&page=1&limit=20`

#### 4. **POST /api/spend/cancel/:spendId**

Cancel pending spend before processing

#### 5. **GET /api/rates/current**

**Response:**

```json
{
  "usdToNgn": 1428.57,
  "lastUpdated": "2024-03-15T10:25:00Z",
  "sources": ["binance", "chainlink"]
}
```

#### 6. **POST /api/banks/validate-account**

Validate bank account before spending

```json
{
  "accountNumber": "0123456789",
  "bankCode": "035"
}
```

---

## Security Measures

### Smart Contract Security

1. **Reentrancy Guards** - Prevent reentrant attacks
2. **Pausable** - Emergency circuit breaker
3. **Rate Limiting** - Max spends per user per day
4. **Timeout Mechanism** - Auto-refund after 15 minutes
5. **Multi-sig for Admin** - Require multiple signatures for critical operations
6. **Upgradeable Contracts** - UUPS pattern for bug fixes

### Backend Security

1. **API Key Rotation** - Rotate bank API keys monthly
2. **Encrypted Storage** - Encrypt sensitive user data
3. **Rate Limiting** - Prevent DDoS attacks
4. **IP Whitelisting** - Restrict bank API access to known IPs
5. **Audit Logging** - Log all transactions immutably
6. **Webhook Verification** - Verify bank callback signatures

### User Protection

1. **Transaction Limits** - Start with low limits, increase with KYC
2. **2FA Option** - Optional two-factor authentication for large spends
3. **Email/SMS Notifications** - Alert users of all transactions
4. **Spending Freeze** - Users can freeze their spend functionality
5. **Suspicious Activity Detection** - ML-based fraud detection

---

## Implementation Milestones

### Phase 1: Foundation (Weeks 1-2)

**Smart Contracts:**

- [ ] Create SpendRouter.sol contract
- [ ] Implement basic escrow logic
- [ ] Add events for spend lifecycle
- [ ] Unit tests (Foundry)
- [ ] Deploy to testnet (Celo Alfajores, Base Sepolia)

**Backend:**

- [ ] Setup Node.js/TypeScript backend
- [ ] Create database schema
- [ ] Implement event listener for blockchain
- [ ] Basic API endpoints (initiate, get status)

**Deliverable:** Working testnet demo with mock bank API

---

### Phase 2: Bank Integration (Weeks 3-4)

**Bank APIs:**

- [ ] Register developer accounts (Wema, Providus)
- [ ] Implement Wema Alat API integration
- [ ] Implement Providus API integration
- [ ] Add Paystack as fallback
- [ ] Account validation endpoint
- [ ] Transfer initiation and status checking
- [ ] Webhook handling for callbacks

**Testing:**

- [ ] Test with real sandbox accounts
- [ ] Verify transaction completion flow
- [ ] Test refund mechanism
- [ ] Load testing (100 concurrent transactions)

**Deliverable:** Full end-to-end flow working in sandbox

---

### Phase 3: Security & Rate Limiting (Week 5)

**Smart Contracts:**

- [ ] Implement SpendRateLimiter.sol
- [ ] Add daily/monthly spending limits
- [ ] Velocity checks
- [ ] Emergency pause functionality
- [ ] Upgrade to multi-sig admin

**Backend:**

- [ ] Rate limiting middleware
- [ ] Fraud detection algorithms
- [ ] User verification system (KYC levels)
- [ ] Webhook signature verification
- [ ] Comprehensive error handling

**Deliverable:** Secure, production-ready contracts and backend

---

### Phase 4: Exchange Rate Oracle (Week 6)

**Smart Contracts:**

- [ ] Create SpendOracle.sol
- [ ] Integrate Chainlink price feeds (if available)
- [ ] Add fallback to API-based rates
- [ ] Rate deviation checks
- [ ] Time-weighted average pricing (TWAP)

**Backend:**

- [ ] Exchange rate aggregator service
- [ ] Multi-source rate fetching (Binance, Coingecko, local)
- [ ] Real-time rate updates
- [ ] Rate caching and staleness detection

**Deliverable:** Reliable, manipulation-resistant exchange rates

---

### Phase 5: Frontend Integration (Weeks 7-8)

**Web App:**

- [ ] Spending UI component
  - Amount input (NGN)
  - Recipient bank details form
  - Bank account validation
  - Rate display and fee breakdown
- [ ] Transaction history page
- [ ] Spending limits dashboard
- [ ] Real-time transaction status updates
- [ ] Success/failure notifications
- [ ] Export transaction statements

**Mobile (MiniPay):**

- [ ] Mobile-optimized spending interface
- [ ] Quick access from wallet home
- [ ] Recipient contact integration
- [ ] Push notifications

**Deliverable:** User-friendly spending interface

---

### Phase 6: Testing & Audits (Weeks 9-10)

**Testing:**

- [ ] End-to-end testing (all user flows)
- [ ] Stress testing (1000s of concurrent users)
- [ ] Security penetration testing
- [ ] Bank API failure scenarios
- [ ] Network congestion simulation
- [ ] Smart contract formal verification

**Audits:**

- [ ] Smart contract audit (CertiK, OpenZeppelin, or Quantstamp)
- [ ] Backend security audit
- [ ] Fix identified vulnerabilities
- [ ] Re-audit if major changes required

**Deliverable:** Audit reports and fixes

---

### Phase 7: Mainnet Launch (Weeks 11-12)

**Pre-Launch:**

- [ ] Deploy contracts to mainnet (Celo, Base)
- [ ] Verify contracts on block explorers
- [ ] Setup mainnet backend infrastructure
- [ ] Configure bank API production credentials
- [ ] Setup monitoring and alerting
- [ ] Create incident response playbook

**Soft Launch:**

- [ ] Limited beta (100 users, $100 limit)
- [ ] Monitor for issues
- [ ] Gather user feedback
- [ ] Optimize based on real usage

**Full Launch:**

- [ ] Remove beta restrictions
- [ ] Marketing campaign
- [ ] User onboarding flow
- [ ] Support documentation

**Deliverable:** Live spending feature on mainnet

---

## Technical Stack

### Smart Contracts

- **Language**: Solidity 0.8.27
- **Framework**: Foundry
- **Upgradeability**: UUPS Proxy Pattern
- **Security**: OpenZeppelin Contracts
- **Testing**: Foundry (unit, integration, fuzz)

### Backend

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js or Fastify
- **Database**: PostgreSQL 15+
- **Caching**: Redis
- **Queue**: BullMQ (for job processing)
- **Event Listening**: Viem or Ethers.js
- **API Client**: Axios with retry logic

### Infrastructure

- **Hosting**: AWS or Railway/Render
- **Blockchain RPC**: Celo (Alfajores), Base (Sepolia/Mainnet)
- **Monitoring**: Sentry (errors), DataDog (metrics)
- **Logging**: Winston or Pino
- **Secrets**: AWS Secrets Manager or HashiCorp Vault

### Frontend Updates

- **Framework**: Next.js 14 (existing)
- **Web3**: Wagmi, Viem (existing)
- **UI**: Tailwind CSS, shadcn/ui (existing)
- **New Components**: Spending interface, transaction history

---

## Cost Estimates

### Development Costs

- **Smart Contract Development**: 2-3 weeks ($15k-$25k)
- **Backend Development**: 4-5 weeks ($25k-$35k)
- **Frontend Integration**: 2-3 weeks ($10k-$15k)
- **Security Audit**: $20k-$40k
- **Testing & QA**: 2 weeks ($8k-$12k)
- **Total Development**: ~$78k-$127k

### Operational Costs (Monthly)

- **Infrastructure**: $200-$500/month
- **Bank API Fees**: Variable (per transaction)
- **Blockchain Gas**: Variable (user-paid)
- **Monitoring Tools**: $100-$300/month
- **Total Monthly**: ~$300-$800 + transaction fees

### Transaction Fees

- **Platform Fee**: 0.3% (existing fee structure)
- **Bank Transfer Fee**: ₦10-₦50 per transfer (absorbed or passed to user)
- **Gas Fees**: Paid by user in USDC (fee abstraction)

---

## Risk Mitigation

### Technical Risks

**Risk**: Bank API downtime
**Mitigation**: Multiple bank providers, automatic fallback, queue retry logic

**Risk**: Exchange rate manipulation
**Mitigation**: Multi-source oracle, rate deviation limits, TWAP pricing

**Risk**: Smart contract vulnerability
**Mitigation**: Professional audit, bug bounty program, emergency pause

**Risk**: Blockchain congestion
**Mitigation**: Gas price optimization, transaction queue management

### Business Risks

**Risk**: Regulatory compliance (CBN regulations)
**Mitigation**: Consult legal experts, implement KYC, transaction reporting

**Risk**: Low adoption
**Mitigation**: Partner with merchants, referral program, lower fees initially

**Risk**: Bank account suspension
**Mitigation**: Multiple bank partnerships, transparent compliance

### Operational Risks

**Risk**: Insufficient liquidity in bank account
**Mitigation**: Auto-top-up mechanism, reserve buffer, real-time monitoring

**Risk**: Backend service failure
**Mitigation**: Auto-scaling, redundancy, health checks, automatic failover

---

## Success Metrics

### Phase 1 (Month 1-2)

- [ ] 100 successful test transactions
- [ ] <5 minute average completion time
- [ ] 99% success rate
- [ ] Zero critical bugs

### Phase 2 (Month 3-6)

- [ ] 1,000 active users
- [ ] $100,000 in transaction volume
- [ ] 98%+ success rate
- [ ] <3 minute average completion time
- [ ] 50+ supported banks

### Phase 3 (Month 6-12)

- [ ] 10,000 active users
- [ ] $1M+ monthly transaction volume
- [ ] 99%+ success rate
- [ ] <2 minute average completion time
- [ ] Integration with major Nigerian merchants

---

## Comparison with Cheesepay

### Cheesepay Features (Reference)

- **Card Issuance**: Virtual/physical cards
- **Instant Conversion**: Crypto to fiat at POS
- **Multi-currency**: Support multiple stablecoins
- **Merchant Network**: Wide acceptance

### Jahpay Differentiation

1. **Direct Bank Transfers**: No card needed, direct to bank account
2. **Lower Fees**: No card issuance/maintenance fees
3. **Celo-First**: Leverage Celo's mobile-first approach
4. **MiniPay Integration**: Native integration with fastest-growing wallet in Africa
5. **Nigerian Focus**: Deep integration with Nigerian banking system

---

## Next Steps

1. **Immediate (This Week)**
   - Review and approve this implementation plan
   - Register for Wema Alat & Providus developer accounts
   - Setup development environment

2. **Week 1-2**
   - Start SpendRouter.sol development
   - Setup backend infrastructure
   - Create database schema

3. **Week 3-4**
   - Bank API integration testing
   - Complete event listener
   - End-to-end testnet demo

4. **Ongoing**
   - Weekly progress reviews
   - Security-first development approach
   - Documentation as we build

---

## Support & Resources

### Banking API Documentation

- [Wema Alat Developer Portal](https://wema-alatdev-apimgt.developer.azure-api.net/)
- [Providus Bank API Docs](https://www.providusbank.com/banking-apis)
- [Paystack Transfers API](https://paystack.com/docs/api/transfer/)
- [Flutterwave Transfers](https://developer.flutterwave.com/docs/transfers)

### Nigerian Banking Codes

[List of Nigerian bank codes](https://nigerianbanks.xyz) for account validation

### Regulatory

- [CBN Guidelines on Digital Payments](https://www.cbn.gov.ng/)
- Know Your Customer (KYC) requirements
- Anti-Money Laundering (AML) compliance

---

**Ready to revolutionize spending in Nigeria! 🚀**
