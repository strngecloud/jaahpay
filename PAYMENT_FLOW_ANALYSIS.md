# Production Payment Flow Analysis - Jahpay Spending Feature

## Executive Summary

**Status**: ⚠️ **NOT PRODUCTION READY** - Critical gaps identified

Based on the provided Bemco payment flow diagram and your current implementation, there are **6 critical missing components** and **8 production readiness concerns** that must be addressed before launch.

---

## Flow Comparison: Required vs Current Implementation

### ✅ What You Have (Implemented)

| Step | Component                    | Status                            |
| ---- | ---------------------------- | --------------------------------- |
| 1    | User initiates payment       | ✅ Partial - Frontend needed      |
| 2    | Virtual account provisioning | ✅ Wema provider configured       |
| 3    | Bank account validation      | ✅ Implemented                    |
| 4    | Database schema              | ✅ Spend entity exists            |
| 5    | Blockchain event listener    | ✅ SpendInitiated listener active |
| 6    | Bank transfer execution      | ✅ Wema + Paystack providers      |
| 7    | Multi-provider fallback      | ✅ Implemented                    |
| 8    | API logging                  | ✅ Bank API logs table            |

### ❌ What You're Missing (Critical Gaps)

| Step | Component                      | Risk Level  | Impact                                       |
| ---- | ------------------------------ | ----------- | -------------------------------------------- |
| 1    | **Payment Session Management** | 🔴 Critical | No reference/URL/expiry/idempotency          |
| 2    | **Webhook Handler**            | 🔴 Critical | Cannot receive bank callbacks                |
| 3    | **Fraud Checks**               | 🔴 Critical | Velocity/duplicate/replay/risk scoring       |
| 4    | **Ledger System**              | 🔴 Critical | No double-entry accounting                   |
| 5    | **Split Execution**            | 🟡 High     | No merchant 80% / platform 20% split         |
| 6    | **Blockchain Completion**      | 🔴 Critical | No `completeSpend()` / `refundSpend()` calls |
| 7    | **Timeout/Auto-refund**        | 🟡 High     | No 15-min timeout mechanism                  |
| 8    | **Transaction Status Polling** | 🟡 Medium   | Real-time detection (<5s) missing            |

---

## Detailed Gap Analysis

### 🔴 CRITICAL GAP #1: Payment Session System

**What's Missing:**

```typescript
// Required but MISSING
interface PaymentSession {
  sessionId: string; // Unique reference
  paymentUrl: string; // Customer payment URL
  expiryTime: Date; // Session timeout (15 min)
  idempotencyKey: string; // Prevent duplicate payments
  status: "active" | "expired" | "completed";
  metadata: {
    userAddress: string;
    amount: number;
    virtualAccount?: string; // Dynamic virtual account
  };
}
```

**Required Flow (from diagram):**

1. Customer clicks "Pay Now" → Backend creates session
2. Session contains: Reference + URL + Expiry + Idempotency key
3. Provision virtual account (Wema/Providus/Parallex)
4. Display payment page with timer countdown
5. Session expires after 15 minutes if not paid

**Current Implementation:**

- ❌ No session table or entity
- ❌ No payment URL generation
- ❌ No expiry mechanism
- ❌ No idempotency protection

**Action Required:**

- Create `PaymentSession` entity
- Implement `/api/payment/session/create` endpoint
- Add timer-based expiry cleanup job
- Generate unique virtual accounts per session (Wema API)

---

### 🔴 CRITICAL GAP #2: Webhook Service

**What's Missing:**
Your diagram shows: "Webhook received: Bank → Webhook Service → Kafka"

**Current State:**

- ❌ No webhook controller (`/api/webhooks/wema`, `/api/webhooks/paystack`)
- ❌ No HMAC signature verification
- ❌ No Kafka producer integration
- ❌ No webhook retry handling
- ❌ No idempotency check for duplicate webhooks

**Required Implementation:**

```typescript
@Controller("webhooks")
export class WebhookController {
  @Post("wema")
  async handleWemaWebhook(@Body() payload, @Headers() headers) {
    // 1. Verify HMAC signature
    if (!this.verifyWemaSignature(payload, headers["x-wema-signature"])) {
      throw new UnauthorizedException();
    }

    // 2. Check idempotency (deduplicate)
    if (await this.isProcessed(payload.transactionReference)) {
      return { status: "already_processed" };
    }

    // 3. Publish to Kafka (async processing)
    await this.kafkaProducer.send({
      topic: "bank-webhooks",
      messages: [{ value: JSON.stringify(payload) }],
    });

    // 4. Return 200 immediately (<5s requirement)
    return { status: "received" };
  }
}
```

**Why Critical:**

- Banks expect **≤5 second response** or they retry
- Without webhooks, you only know transfer status via polling (slow!)
- Real-time payment confirmation impossible

---

### 🔴 CRITICAL GAP #3: Fraud Detection System

**From Diagram:** "Fraud checks: Velocity · Duplicate · Replay · Risk score"

**Current State:**

- ✅ Basic spend limits exist (`SpendLimitService`)
- ❌ No velocity checks (transactions per hour/minute)
- ❌ No duplicate transaction detection
- ❌ No replay attack prevention
- ❌ No risk scoring algorithm
- ❌ No suspicious activity flagging

**Required Checks:**

**a) Velocity Check**

```typescript
// Detect rapid-fire transactions
interface VelocityCheck {
  maxTransactionsPerMinute: 2;
  maxTransactionsPerHour: 10;
  suspiciousPattern: "identical amounts in <60s";
}
```

**b) Duplicate Detection**

```typescript
// Same user, same amount, same recipient within 5 minutes
const isDuplicate = await this.checkDuplicate({
  userAddress,
  amount,
  recipient,
  timeWindow: "5 minutes",
});
```

**c) Replay Protection**

```typescript
// Prevent reusing old transaction signatures
const nonceUsed = await redis.get(`nonce:${transactionHash}`);
if (nonceUsed) throw new ReplayAttackException();
await redis.setex(`nonce:${transactionHash}`, 3600, "used");
```

**d) Risk Scoring**

```typescript
interface RiskScore {
  newUser: number; // +20 points if account <7 days old
  highAmount: number; // +30 points if >$500
  unusualTime: number; // +10 points if 2-6 AM
  velocityFlag: number; // +40 points if rapid transactions
  total: number; // >70 = block, 50-70 = review, <50 = allow
}
```

**Action Required:**

- Create `FraudCheckService`
- Implement all 4 check types
- Add `risk_score` column to spends table
- Auto-block transactions with score >70

---

### 🔴 CRITICAL GAP #4: Ledger System (Double-Entry Accounting)

**From Diagram:** "Ledger posting: Double-entry · Journal entries · Immutable"

**Current State:**

- ❌ No ledger tables
- ❌ No double-entry bookkeeping
- ❌ Cannot audit money flow
- ❌ No reconciliation capability

**Required Schema:**

```sql
CREATE TABLE ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  entry_id UUID UNIQUE NOT NULL,
  spend_id VARCHAR(66) NOT NULL,
  account_type VARCHAR(50) NOT NULL,  -- user_balance, platform_fee, merchant_payout
  debit_amount DECIMAL(20, 6),        -- Money going out
  credit_amount DECIMAL(20, 6),       -- Money coming in
  balance_after DECIMAL(20, 6) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  is_immutable BOOLEAN DEFAULT TRUE   -- Cannot be edited once written
);

CREATE INDEX idx_ledger_spend ON ledger_entries(spend_id);
CREATE INDEX idx_ledger_account ON ledger_entries(account_type);
```

**Double-Entry Example:**
When user spends $100 USDC (0.3% fee = $0.30):

```typescript
// Entry 1: Deduct from user
{
  account_type: 'user_balance',
  debit_amount: 100.30,
  credit_amount: 0,
  description: 'User spend initiated'
}

// Entry 2: Credit platform fee
{
  account_type: 'platform_fee',
  debit_amount: 0,
  credit_amount: 0.30,
  description: 'Platform fee collected'
}

// Entry 3: Credit merchant
{
  account_type: 'merchant_payout',
  debit_amount: 0,
  credit_amount: 100.00,
  description: 'Merchant payment'
}

// Sum check: Debits (100.30) = Credits (0.30 + 100.00) ✅
```

**Why Critical:**

- Required for financial audits
- Detects missing/extra money
- Regulatory compliance (SEC, accounting standards)

---

### 🟡 HIGH PRIORITY GAP #5: Split Execution

**From Diagram:** "Split execution: Bemcol 20% · Merchant 80%"

**Current State:**

- ✅ Platform fee (0.3%) calculated
- ❌ No merchant split logic
- ❌ No separate merchant settlement

**Required Logic:**

```typescript
async executeSplit(spend: SpendEntity) {
  const totalNGN = spend.ngnAmount;
  const platformShare = totalNGN * 0.20;  // 20%
  const merchantShare = totalNGN * 0.80;  // 80%

  // Transfer to merchant
  await this.bankService.transfer({
    accountNumber: merchant.accountNumber,
    amount: merchantShare,
    narration: `Payment from ${spend.userAddress.slice(0, 8)}`,
  });

  // Platform fee already collected in USDC on-chain
  // Just record it in ledger
  await this.ledgerService.recordPlatformRevenue(platformShare);
}
```

**Note:** Your spec says 0.3% platform fee, but diagram shows 20%. Clarify business logic!

---

### 🔴 CRITICAL GAP #6: Blockchain Transaction Completion

**Current State:**

```typescript
// spend-processor.service.ts Line 72-73
// TODO: Call smart contract completeSpend() function
// await this.blockchainService.completeSpend(spend.spendId, result.reference);

// Line 91-92
// TODO: Call smart contract refundSpend() function
// await this.blockchainService.refundSpend(spend.spendId, error.message);
```

**Why Critical:**

- USDC is locked in `SpendRouter` contract escrow
- If you don't call `completeSpend()`, money stays locked forever
- If you don't call `refundSpend()`, user never gets money back

**Required Implementation:**

```typescript
@Injectable()
export class BlockchainService {
  async completeSpend(spendId: string, bankRef: string): Promise<void> {
    const walletClient = this.getAuthorizedProcessorWallet();

    const hash = await walletClient.writeContract({
      address: SPEND_ROUTER_ADDRESS,
      abi: SPEND_ROUTER_ABI,
      functionName: "completeSpend",
      args: [BigInt(spendId), bankRef],
    });

    await this.celoClient.waitForTransactionReceipt({ hash });
    this.logger.log(`Spend ${spendId} completed on-chain: ${hash}`);
  }

  async refundSpend(spendId: string, reason: string): Promise<void> {
    const walletClient = this.getAuthorizedProcessorWallet();

    const hash = await walletClient.writeContract({
      address: SPEND_ROUTER_ADDRESS,
      abi: SPEND_ROUTER_ABI,
      functionName: "refundSpend",
      args: [BigInt(spendId), reason],
    });

    await this.celoClient.waitForTransactionReceipt({ hash });
    this.logger.log(`Spend ${spendId} refunded on-chain: ${hash}`);
  }
}
```

**Security:**

- Only authorized processor wallet can call these functions
- Store processor private key in AWS Secrets Manager (NOT .env)
- Use separate wallet for each chain (Celo/Base)

---

## Production Readiness Checklist

### 🔐 Security Issues

| Issue                           | Status | Fix Required              |
| ------------------------------- | ------ | ------------------------- |
| Processor wallet key management | ❌     | Use AWS Secrets Manager   |
| Webhook signature verification  | ❌     | Implement HMAC validation |
| Rate limiting on APIs           | ❌     | Add express-rate-limit    |
| SQL injection prevention        | ✅     | TypeORM handles this      |
| Replay attack protection        | ❌     | Add nonce tracking        |
| Environment variable validation | ⚠️     | Add joi schema validation |

### 📊 Observability Gaps

| Component      | Current    | Required                        |
| -------------- | ---------- | ------------------------------- |
| Error tracking | ❌         | Sentry integration              |
| APM monitoring | ❌         | DataDog / New Relic             |
| Logging        | ⚠️ Partial | Winston with structured logs    |
| Metrics        | ❌         | Prometheus + Grafana            |
| Alerting       | ❌         | PagerDuty for critical failures |

### 🧪 Testing Coverage

**Current State:** No tests found

**Required:**

```bash
apps/server/test/
├── unit/
│   ├── spend.service.spec.ts
│   ├── fraud-check.service.spec.ts
│   └── blockchain.service.spec.ts
├── integration/
│   ├── spend-flow.e2e.spec.ts
│   ├── webhook.e2e.spec.ts
│   └── bank-provider.e2e.spec.ts
└── load/
    └── k6-load-test.js  # 1000 concurrent transactions
```

### 🏗️ Infrastructure Missing

| Component          | Purpose                                 | Priority    |
| ------------------ | --------------------------------------- | ----------- |
| Redis              | Session storage, rate limiting, caching | 🔴 Critical |
| Kafka              | Async webhook processing                | 🟡 High     |
| PostgreSQL replica | Read scaling                            | 🟢 Medium   |
| Job queue (BullMQ) | Retry failed transfers                  | 🔴 Critical |
| CDN                | API response caching                    | 🟢 Low      |

---

## Recommended Implementation Order

### Phase 1: Critical Fixes (Week 1) - MUST DO BEFORE LAUNCH

1. **Blockchain completion calls** (2 days)
   - Implement `completeSpend()` and `refundSpend()`
   - Setup processor wallet with Secrets Manager
   - Add transaction confirmation waiting

2. **Webhook handler** (2 days)
   - Create webhook controller
   - HMAC signature verification
   - Idempotency checks
   - Return <5s response

3. **Fraud detection** (3 days)
   - Velocity checks
   - Duplicate detection
   - Replay protection
   - Risk scoring

### Phase 2: High Priority (Week 2)

4. **Payment session system** (2 days)
   - Session entity
   - Expiry mechanism
   - Virtual account provisioning

5. **Ledger system** (3 days)
   - Double-entry tables
   - Journal entry recording
   - Reconciliation reports

6. **Timeout/auto-refund** (2 days)
   - Cron job to check timed-out spends
   - Auto-trigger refunds after 15 min

### Phase 3: Production Hardening (Week 3)

7. **Infrastructure setup**
   - Redis cluster
   - BullMQ for job processing
   - Kafka (or skip if webhook volume <1000/day)

8. **Observability**
   - Sentry error tracking
   - DataDog APM
   - Alerting rules

9. **Testing**
   - Unit tests (80% coverage)
   - Integration tests
   - Load testing (1000 concurrent)

---

## Critical Code Issues Found

### Issue #1: Missing Transaction Cleanup

**File:** `apps/server/src/blockchain/blockchain.service.ts`

```typescript
// PROBLEM: Events defined but never used
private readonly SPEND_COMPLETED_EVENT = parseAbiItem(...);  // ❌ Never listened
private readonly SPEND_REFUNDED_EVENT = parseAbiItem(...);   // ❌ Never listened
```

**Fix:** Listen to these events to update database even if backend crashes.

### Issue #2: Incomplete Error Handling

**File:** `apps/server/src/spend/services/spend-processor.service.ts:91`

```typescript
// PROBLEM: Error logged but no retry attempted
} catch (error) {
  this.logger.error(`Bank transfer failed for spend ${spend.spendId}:`, error);
  await this.markSpendAsFailed(spend.spendId, ...);
  // TODO: Call smart contract refundSpend() function  ❌ NOT IMPLEMENTED
}
```

**Fix:** Implement retry with exponential backoff before marking as failed.

### Issue #3: Race Condition Risk

**File:** `apps/server/src/spend/spend.service.ts:57-58`

```typescript
// PROBLEM: Record spending AFTER database save
const savedSpend = await this.spendRepo.save(spend);
await this.spendLimitService.recordSpend(dto.userAddress, totalUSDCRequired);
```

**Fix:** Use database transaction to ensure atomic operations:

```typescript
await this.spendRepo.manager.transaction(async (manager) => {
  const savedSpend = await manager.save(spend);
  await this.spendLimitService.recordSpend(dto.userAddress, totalUSDCRequired);
});
```

### Issue #4: No Webhook Signature Check

**File:** `apps/server/src/bank/providers/wema.provider.ts:31`

```typescript
private readonly callbackUrl: string;  // ❌ Declared but never used
```

**Missing:** Webhook verification logic.

---

## Estimated Effort

| Component               | Effort      | Developer Time      |
| ----------------------- | ----------- | ------------------- |
| Phase 1 (Critical)      | 7 days      | 1 senior engineer   |
| Phase 2 (High Priority) | 7 days      | 1 senior engineer   |
| Phase 3 (Production)    | 7 days      | 1 senior + 1 DevOps |
| **Total**               | **21 days** | **~$25k-$35k**      |

---

## Risk Assessment

### Launch Without Fixes

| Risk                            | Probability | Impact      | Mitigation                |
| ------------------------------- | ----------- | ----------- | ------------------------- |
| User funds locked forever       | 90%         | 🔴 Critical | Fix blockchain completion |
| Fraud/duplicate payments        | 80%         | 🔴 Critical | Implement fraud checks    |
| Bank webhook failures           | 70%         | 🔴 Critical | Add webhook handler       |
| Money reconciliation impossible | 100%        | 🟡 High     | Build ledger system       |
| System overload (DDoS)          | 60%         | 🟡 High     | Add rate limiting         |

### Recommended Launch Strategy

**Option 1: Soft Launch (Recommended)**

- Deploy with Phase 1 fixes only
- Limit to 100 beta users
- Max transaction: $100 USD
- 24/7 monitoring for first week
- Manual intervention available

**Option 2: Full Launch**

- Complete all 3 phases
- Professional security audit ($15k-$25k)
- Load test with 10,000 simulated transactions
- Insurance/reserve fund for errors

---

## Questions to Answer Before Launch

1. **Business Logic:** Is platform fee 0.3% or 20%? (Spec says 0.3%, diagram says 20%)
2. **Virtual Accounts:** Does Wema provide unique accounts per session, or shared account?
3. **Settlement:** Who is the "merchant" in split execution? Is it utility companies?
4. **Compliance:** Do you have CBN approval for naira transactions?
5. **KYC:** What KYC level is required? (Affects transaction limits)
6. **Refund SLA:** How fast must refunds be processed? (Diagram shows instant)
7. **Backup Plan:** If all banks fail, do you refund immediately or queue for retry?

---

## Conclusion

**Your current implementation has ~60% of the required payment flow.** The missing 40% includes:

- **Critical security components** (fraud checks, webhooks)
- **Financial integrity** (ledger, double-entry)
- **Blockchain finalization** (complete/refund calls)

**Recommendation:** Do NOT launch to production until Phase 1 (Critical Fixes) is completed. You risk:

- Lost user funds (no blockchain completion)
- Fraud exploitation (no velocity checks)
- Undetectable financial discrepancies (no ledger)

**Estimated time to production-ready:** 3-4 weeks with 1-2 senior engineers.

---

**Ready to proceed?** Start with implementing blockchain completion calls—that's the highest risk item.
