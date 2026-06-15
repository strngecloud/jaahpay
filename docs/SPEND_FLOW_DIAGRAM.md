# Spend Flow Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                     (Next.js + React + Wagmi)                   │
└────────────────┬────────────────────────────────┬───────────────┘
                 │                                │
                 │ HTTP API                       │ Web3 RPC
                 │                                │
      ┌──────────▼──────────┐          ┌─────────▼────────┐
      │   BACKEND SERVER    │          │  CELO BLOCKCHAIN │
      │   (NestJS + Node)   │          │  (Smart Contracts)│
      └──────────┬──────────┘          └─────────┬────────┘
                 │                                │
    ┌────────────┼────────────┐                  │
    │            │            │                  │
┌───▼───┐  ┌────▼────┐  ┌───▼────┐              │
│  DB   │  │  REDIS  │  │  BANK  │              │
│Postgres│  │ (Cache) │  │  APIs  │              │
└───────┘  └─────────┘  └────────┘              │
                                                 │
                                        ┌────────▼─────────┐
                                        │  RampAggregator  │
                                        │   (User-facing)  │
                                        └──────────────────┘
```

---

## Transaction Flow Sequence

```
USER                CLIENT              SERVER              BLOCKCHAIN          BANK API
 │                    │                   │                      │                │
 │──Enter Account────▶│                   │                      │                │
 │                    │──Validate────────▶│                      │                │
 │                    │                   │──Check Account──────────────────────▶│
 │                    │                   │◀─Account Name────────────────────────│
 │                    │◀─Verified─────────│                      │                │
 │◀─Show Name─────────│                   │                      │                │
 │                    │                   │                      │                │
 │──Confirm───────────▶│                   │                      │                │
 │                    │                   │                      │                │
 │──Enter Amount──────▶│──Get Rate────────▶│                      │                │
 │                    │◀─Exchange Rate────│                      │                │
 │◀─Show Quote────────│                   │                      │                │
 │                    │                   │                      │                │
 │──Confirm & Send────▶│──Initiate Spend─▶│                      │                │
 │                    │                   │──Fraud Check───────▶ DB               │
 │                    │                   │──Lock Rate──────────▶ DB              │
 │                    │                   │──Create Record──────▶ DB              │
 │                    │◀─tempSpendId──────│                      │                │
 │                    │                   │                      │                │
 │                    │──Approve USDC────────────────────────────▶│                │
 │                    │                   │                      │                │
 │◀─Sign Approval─────│                   │                      │                │
 │──Signed────────────▶│                   │                      │                │
 │                    │──TX Sent───────────────────────────────▶│                │
 │                    │◀─TX Hash───────────────────────────────│                │
 │                    │                   │                      │                │
 │                    │──initiateOffRamp──────────────────────▶│                │
 │◀─Sign TX───────────│                   │                      │                │
 │──Signed────────────▶│                   │                      │                │
 │                    │──TX Sent───────────────────────────────▶│                │
 │                    │◀─TX Hash───────────────────────────────│                │
 │                    │                   │                      │                │
 │                    │──Confirm Blockchain──▶│                      │                │
 │                    │   (tempSpendId, txHash, spendId)           │                │
 │                    │                   │──Update DB──────────▶ DB              │
 │                    │◀─Success──────────│                      │                │
 │                    │                   │                      │                │
 │◀─Processing────────│                   │                      │                │
 │  (polling starts)  │                   │                      │                │
 │                    │                   │                      │                │
 │                    │                   │──Transfer NGN──────────────────────▶│
 │                    │                   │                      │                │
 │                    │──Poll Status─────▶│                      │                │
 │                    │◀─Status: processing─│                      │                │
 │◀─Update UI─────────│                   │                      │                │
 │                    │                   │                      │                │
 │                    │                   │◀─Transfer Success────────────────────│
 │                    │                   │──completeOffRamp────────────────────▶│
 │                    │                   │                      │                │
 │                    │──Poll Status─────▶│                      │                │
 │                    │◀─Status: completed──│                      │                │
 │◀─Show Success──────│                   │                      │                │
 │  (bank ref)        │                   │                      │                │
 │                    │                   │                      │                │
```

---

## Component Hierarchy

```
<SpendPanel>
  │
  ├─ Step: "recipient"
  │   ├── <RecipientForm>
  │   │     ├── Account Input
  │   │     ├── Bank Selector
  │   │     └── Verification Status
  │   │
  │   └── <RecipientList>
  │         ├── Recent Recipients
  │         └── Favorites
  │
  ├─ Step: "confirm"
  │   └── <RecipientConfirm>
  │         ├── Recipient Card
  │         ├── Account Details
  │         └── Confirm Button
  │
  ├─ Step: "amount"
  │   └── <AmountEntry>
  │         ├── NGN Input
  │         ├── USDC Equivalent
  │         ├── Exchange Rate Display
  │         └── Narration Input
  │
  ├─ Step: "review"
  │   └── <SpendReview>
  │         ├── Recipient Summary
  │         ├── Financial Breakdown
  │         ├── Balance Check
  │         └── Confirm & Send Button
  │
  └─ Step: "processing" | "complete" | "error"
      └── <SpendProcessing>
            ├── Progress Steps
            ├── Transaction Hash Link
            ├── Bank Reference
            └── Done / Retry Button
```

---

## State Machine

```
┌────────────┐
│  recipient │ ◀── Initial state
└─────┬──────┘
      │ handleRecipientConfirmed()
      ▼
┌────────────┐
│   amount   │
└─────┬──────┘
      │ goToReview()
      ▼
┌────────────┐
│   review   │
└─────┬──────┘
      │ executeSpend()
      ▼
┌────────────┐      Sub-steps:
│ processing │ ───▶ 1. approving
└─────┬──────┘      2. sending
      │             3. bank-transfer
      │             4. complete
      ├─────────────────────┐
      │                     │
      ▼                     ▼
┌────────────┐        ┌─────────┐
│  complete  │        │  error  │
└─────┬──────┘        └────┬────┘
      │                    │ retryFromReview()
      │ resetFlow()        │
      ▼                    ▼
┌────────────┐        ┌────────────┐
│  recipient │        │   review   │
└────────────┘        └────────────┘
```

---

## Hook Dependencies

```
<SpendPanel>
  │
  ├── useSpendFlow()
  │     ├── useAccount()         // Wagmi
  │     ├── useChainId()         // Wagmi
  │     ├── useWriteContract()   // Wagmi (x2 for approve + offRamp)
  │     └── useExchangeRate()
  │           └── useQuery()     // React Query
  │
  ├── useSpendRecipient()
  │     └── validateAccount()    // API call
  │
  ├── useSpendRecipients()
  │
  └── useReadContract()          // For USDC balance
```

---

## API Endpoints Map

```
┌──────────────────────────────────────────────┐
│         SERVER API ENDPOINTS                 │
├──────────────────────────────────────────────┤
│                                              │
│  POST /spend/initiate                        │
│    ▸ Validates account                       │
│    ▸ Runs fraud checks                       │
│    ▸ Locks exchange rate                     │
│    ▸ Creates spend record                    │
│    ▸ Returns quote + tempSpendId             │
│                                              │
│  GET /spend/:spendId                         │
│    ▸ Returns current spend status            │
│    ▸ Polled every 5s during processing       │
│                                              │
│  POST /spend/confirm-blockchain              │
│    ▸ Links tempSpendId with blockchain tx    │
│    ▸ Updates spend with real spendId         │
│                                              │
│  POST /spend/cancel/:spendId                 │
│    ▸ Cancels pending spend                   │
│    ▸ Triggers refund if needed               │
│                                              │
│  POST /spend/validate-account                │
│    ▸ Verifies bank account via Wema/Providus │
│    ▸ Returns account name                    │
│                                              │
│  GET /rates/current                          │
│    ▸ Returns live USD→NGN rate               │
│    ▸ Cached for 30s, refreshes every 60s     │
│                                              │
└──────────────────────────────────────────────┘
```

---

## Smart Contract Interactions

```
USER WALLET                 USDC TOKEN              RAMP AGGREGATOR
     │                           │                         │
     │──approve()───────────────▶│                         │
     │  (spender: rampAddress,   │                         │
     │   amount: totalUSDC)      │                         │
     │                           │                         │
     │◀─Approved─────────────────│                         │
     │                           │                         │
     │──initiateOffRamp()─────────────────────────────────▶│
     │  (amount, "jahpay",       │                         │
     │   requestId)              │                         │
     │                           │                         │
     │                           │◀─transferFrom()─────────│
     │                           │  (user, contract,       │
     │                           │   amount)               │
     │                           │                         │
     │                           │──USDC Transferred──────▶│
     │                           │                         │
     │◀─SpendInitiated Event──────────────────────────────│
     │  (spendId, user,          │                         │
     │   usdcAmount, ngnAmount)  │                         │
     │                           │                         │

     ... Bank transfer happens off-chain ...

BACKEND PROCESSOR           RAMP AGGREGATOR
     │                           │
     │──completeOffRamp()───────▶│
     │  (requestId)              │
     │                           │
     │◀─OffRampCompleted Event──│
     │  (requestId, timestamp)   │
     │                           │

     OR if failed:

     │──refundSpend()───────────▶│
     │  (requestId, reason)      │
     │                           │
     │                           │──Refund USDC─────────▶ USER
     │                           │                         │
     │◀─OffRampRefunded Event───│
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────┐
│                   ERROR SCENARIOS                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. INSUFFICIENT BALANCE                            │
│     ├─ Detected: Review step                       │
│     ├─ Action: Block "Confirm & Send" button       │
│     └─ Resolution: User must add USDC              │
│                                                     │
│  2. BLOCKCHAIN TX REJECTED                          │
│     ├─ Detected: User wallet                       │
│     ├─ Action: Show error, no server side-effect   │
│     └─ Resolution: Retry from review               │
│                                                     │
│  3. APPROVAL FAILED                                 │
│     ├─ Detected: ERC20 approve call                │
│     ├─ Action: Show error message                  │
│     └─ Resolution: Retry with more gas             │
│                                                     │
│  4. BANK TRANSFER FAILED                            │
│     ├─ Detected: Bank API response                 │
│     ├─ Action: Server calls refundSpend()          │
│     ├─ Status: Changes to "refunded"               │
│     └─ Resolution: USDC returned to user           │
│                                                     │
│  5. TIMEOUT (15 MINUTES)                            │
│     ├─ Detected: Backend cron job                  │
│     ├─ Action: Calls emergencyRefund()             │
│     ├─ Status: Changes to "refunded"               │
│     └─ Resolution: USDC returned to user           │
│                                                     │
│  6. FRAUD DETECTION TRIGGERED                       │
│     ├─ Detected: Before initiateSpend              │
│     ├─ Action: Reject with fraud error             │
│     └─ Resolution: User contact support            │
│                                                     │
│  7. RATE LIMIT EXCEEDED                             │
│     ├─ Detected: Before initiateSpend              │
│     ├─ Action: Reject with limit error             │
│     └─ Resolution: Wait for daily/monthly reset    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
CREATE TABLE spends (
    spend_id VARCHAR(66) PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    chain VARCHAR(10) NOT NULL,
    usdc_amount DECIMAL(18,6) NOT NULL,
    ngn_amount DECIMAL(18,2) NOT NULL,
    exchange_rate DECIMAL(10,2) NOT NULL,
    platform_fee_usdc DECIMAL(18,6) NOT NULL,
    recipient_account_number VARCHAR(10) NOT NULL,
    recipient_bank_code VARCHAR(6) NOT NULL,
    recipient_account_name VARCHAR(255),
    narration VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    bank_reference VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    INDEX idx_user_status (user_address, status),
    INDEX idx_created (created_at)
);

CREATE TABLE spend_limits (
    user_address VARCHAR(42) PRIMARY KEY,
    daily_limit_usdc DECIMAL(18,6) DEFAULT 100,
    monthly_limit_usdc DECIMAL(18,6) DEFAULT 1000,
    daily_spent_usdc DECIMAL(18,6) DEFAULT 0,
    monthly_spent_usdc DECIMAL(18,6) DEFAULT 0,
    last_daily_reset TIMESTAMP,
    last_monthly_reset TIMESTAMP
);
```

---

## Key Metrics & Monitoring

```
┌────────────────────────────────────────┐
│         METRICS TO TRACK               │
├────────────────────────────────────────┤
│                                        │
│  ✓ Success Rate                        │
│    - Completed / Total Initiated       │
│    - Target: >95%                      │
│                                        │
│  ✓ Average Completion Time             │
│    - From initiate to completed        │
│    - Target: <5 minutes                │
│                                        │
│  ✓ Step Drop-off Rate                  │
│    - recipient → amount                │
│    - amount → review                   │
│    - review → complete                 │
│                                        │
│  ✓ Refund Rate                         │
│    - Refunded / Total                  │
│    - Target: <2%                       │
│                                        │
│  ✓ Fraud Detection Hits                │
│    - Blocked / Total                   │
│    - Review for false positives        │
│                                        │
│  ✓ Average Transaction Value           │
│    - Mean NGN amount                   │
│    - Median NGN amount                 │
│                                        │
│  ✓ Bank API Latency                    │
│    - Account verification time         │
│    - Transfer execution time           │
│                                        │
└────────────────────────────────────────┘
```

---

This diagram provides a visual reference for understanding how all the pieces fit together!
