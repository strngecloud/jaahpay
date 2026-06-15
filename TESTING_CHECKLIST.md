# Spend Flow Testing Checklist

Use this checklist to verify the spend flow works correctly before deploying to production.

---

## ✅ Pre-Testing Setup

### Environment Configuration

- [ ] Server `.env` has all required variables
  - [ ] Database connection (PostgreSQL)
  - [ ] Redis connection
  - [ ] Bank API keys (Wema/Providus)
  - [ ] Blockchain RPC URL
  - [ ] Processor wallet private key
  - [ ] Exchange rate API keys

- [ ] Web `.env` has required variables
  - [ ] `NEXT_PUBLIC_SPEND_API_URL`
  - [ ] `NEXT_PUBLIC_RAMP_AGGREGATOR_ADDRESS`
  - [ ] `NEXT_PUBLIC_CHAIN_ID`

- [ ] Services are running
  - [ ] PostgreSQL (port 5432)
  - [ ] Redis (port 6379)
  - [ ] Backend server (port 3001)
  - [ ] Frontend dev server (port 3000)

### Database Setup

- [ ] Migrations have been run
- [ ] `spends` table exists
- [ ] `spend_limits` table exists
- [ ] Database is accessible

### Wallet Setup

- [ ] Test wallet has CELO for gas
- [ ] Test wallet has USDC (at least 10 USDC)
- [ ] Wallet is connected to Alfajores testnet
- [ ] RampAggregator contract is deployed on testnet

---

## 🧪 Functional Tests

### 1. Recipient Selection Flow

- [ ] Enter 10-digit account number
- [ ] Account number field only accepts digits
- [ ] Counter shows X/10 characters
- [ ] Select bank from dropdown
- [ ] Account verification triggers automatically
- [ ] Loading spinner shows during verification
- [ ] Account name displays after verification
- [ ] Green checkmark appears on success
- [ ] Error message shows for invalid account
- [ ] "Next" button is disabled until verified
- [ ] "Next" button is enabled after verification
- [ ] Click "Next" transitions to confirm step

### 2. Recipient Confirmation

- [ ] Recipient details display correctly
  - [ ] Account name
  - [ ] Account number
  - [ ] Bank name
- [ ] Bank avatar shows
- [ ] Green checkmark icon visible
- [ ] "Back" button returns to recipient step
- [ ] "Confirm Recipient" button proceeds to amount

### 3. Amount Entry

- [ ] Back button returns to recipient step
- [ ] NGN input field accepts decimals
- [ ] Only numbers and decimal point allowed
- [ ] Maximum 2 decimal places enforced
- [ ] ₦ symbol displays
- [ ] USDC equivalent updates in real-time
- [ ] Exchange rate displays correctly
- [ ] Rate confidence indicator shows (if <0.8)
- [ ] Narration field accepts text
- [ ] Narration limited to 255 characters
- [ ] Character counter shows for narration
- [ ] Min amount validation (₦100)
  - [ ] Error shows for amount < ₦100
  - [ ] Continue button disabled
- [ ] Max amount validation (₦1,000,000)
  - [ ] Error shows for amount > ₦1,000,000
  - [ ] Continue button disabled
- [ ] Valid amount enables Continue button
- [ ] Continue proceeds to review step

### 4. Review Screen

- [ ] Back button returns to amount step
- [ ] Recipient summary displays correctly
- [ ] Financial breakdown shows:
  - [ ] NGN amount formatted
  - [ ] Exchange rate
  - [ ] USDC amount (before fee)
  - [ ] Platform fee (0.3%)
  - [ ] Total USDC required
- [ ] USDC balance displays
- [ ] Loading state shows while fetching balance
- [ ] Insufficient balance shows warning
  - [ ] Warning has red background
  - [ ] Warning explains shortfall
  - [ ] "Confirm & Send" button disabled
- [ ] Sufficient balance allows confirmation
- [ ] Estimated completion time shows
- [ ] Security disclaimer visible
- [ ] "Confirm & Send" button is prominent

### 5. Processing Steps

#### Approval Step

- [ ] Wallet popup appears for USDC approval
- [ ] Progress shows "Approving USDC"
- [ ] Step 1 is active/loading
- [ ] User can sign in wallet
- [ ] After signing, step 1 completes (✓)
- [ ] Rejection shows error state

#### Off-Ramp Step

- [ ] Wallet popup appears for off-ramp tx
- [ ] Progress shows "Sending to contract"
- [ ] Step 2 is active/loading
- [ ] User can sign in wallet
- [ ] After signing, step 2 completes (✓)
- [ ] Transaction hash appears
- [ ] Rejection shows error state

#### Bank Transfer Step

- [ ] Progress shows "Bank transfer in progress"
- [ ] Step 3 is active/loading
- [ ] UI polls server every 5 seconds
- [ ] No user action required
- [ ] Backend initiates bank transfer

#### Completion Step

- [ ] Progress shows "Transfer Complete"
- [ ] All steps have checkmarks (✓)
- [ ] Success icon displays (green)
- [ ] Transaction details show:
  - [ ] Amount sent (NGN)
  - [ ] Recipient name
  - [ ] Bank reference
- [ ] Celoscan link appears
- [ ] "Done" button visible
- [ ] "Done" resets flow to recipient step

### 6. Error States

#### Insufficient Balance

- [ ] Warning shows on review screen
- [ ] "Confirm & Send" button disabled
- [ ] Clear explanation of shortfall
- [ ] User can go back to adjust amount

#### User Rejects Approval

- [ ] Error screen shows
- [ ] Clear error message
- [ ] "Try Again" button visible
- [ ] Retry returns to review step
- [ ] "Close" button resets flow

#### User Rejects Transaction

- [ ] Error screen shows
- [ ] Clear error message
- [ ] "Try Again" button visible
- [ ] Retry returns to review step
- [ ] "Close" button resets flow

#### Bank Transfer Fails

- [ ] Error screen shows after timeout
- [ ] Error message explains failure
- [ ] Refund is mentioned
- [ ] "Close" button resets flow
- [ ] Server triggers refund
- [ ] USDC returns to user wallet

#### Network Error

- [ ] Error screen shows
- [ ] Error message explains issue
- [ ] "Try Again" option available
- [ ] Server state remains consistent

---

## 🔍 Edge Case Tests

### Amount Validation

- [ ] Enter ₦0 → error message
- [ ] Enter ₦50 → "Minimum ₦100" error
- [ ] Enter ₦100 → accepted
- [ ] Enter ₦999,999 → accepted
- [ ] Enter ₦1,000,000 → accepted
- [ ] Enter ₦1,000,001 → "Maximum ₦1,000,000" error
- [ ] Enter ₦1000000000 → error

### Account Number Validation

- [ ] Enter 9 digits → not verified
- [ ] Enter 10 digits → auto-verifies
- [ ] Enter 11 digits → truncated to 10
- [ ] Enter letters → rejected
- [ ] Enter special chars → rejected
- [ ] Paste valid number → works
- [ ] Paste invalid format → cleaned

### Narration Field

- [ ] Enter 255 characters → accepted
- [ ] Enter 256 characters → rejected
- [ ] Leave empty → accepted (optional)
- [ ] Special characters → accepted
- [ ] Emoji → accepted

### Exchange Rate

- [ ] Rate updates every 60 seconds
- [ ] Stale rate (>30s) refetches
- [ ] Failed rate fetch shows error
- [ ] USDC equivalent recalculates on rate change

### Balance Check

- [ ] Balance loads on review step
- [ ] Balance doesn't load on other steps
- [ ] Null balance shows loading state
- [ ] Zero balance shows warning
- [ ] Balance updates if wallet changes

### Navigation

- [ ] Back from amount → recipient
- [ ] Back from review → amount
- [ ] Recipient data persists on back
- [ ] Amount persists on back
- [ ] Can't skip steps
- [ ] URL doesn't change (SPA behavior)

---

## 🚦 Integration Tests

### Server API

- [ ] `GET /rates/current` returns exchange rate
- [ ] `POST /spend/validate-account` validates accounts
- [ ] `POST /spend/initiate` creates spend record
- [ ] `GET /spend/:id` returns spend status
- [ ] `POST /spend/confirm-blockchain` updates spend
- [ ] Fraud checks run before initiate
- [ ] Spend limits enforced

### Blockchain

- [ ] USDC approval succeeds
- [ ] Approval amount is correct (totalUSDC)
- [ ] Off-ramp tx succeeds
- [ ] Off-ramp emits SpendInitiated event
- [ ] Backend catches event
- [ ] Backend calls completeOffRamp on success
- [ ] Backend calls refundSpend on failure

### Bank API

- [ ] Account validation works
- [ ] Transfer succeeds
- [ ] Bank reference returned
- [ ] Failed transfer detected
- [ ] Retry logic works

---

## 📱 UI/UX Tests

### Responsiveness

- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Mobile landscape

### Animations

- [ ] Step transitions smooth
- [ ] Loading spinners animate
- [ ] Success checkmarks appear
- [ ] Error icons appear
- [ ] Fade in/out effects work

### Accessibility

- [ ] Tab navigation works
- [ ] Enter key submits forms
- [ ] Focus states visible
- [ ] Error messages announced
- [ ] Color contrast sufficient
- [ ] Text is readable

### Performance

- [ ] Initial load <2s
- [ ] Step transitions <200ms
- [ ] API calls <1s
- [ ] No memory leaks
- [ ] Smooth scrolling

---

## 🔐 Security Tests

### Input Validation

- [ ] SQL injection attempts blocked
- [ ] XSS attempts blocked
- [ ] Account number sanitized
- [ ] Amount validated server-side
- [ ] Narration escaped

### Rate Limiting

- [ ] Daily spend limit enforced
- [ ] Monthly spend limit enforced
- [ ] Limit resets at midnight (daily)
- [ ] Limit resets on 1st (monthly)
- [ ] Exceeded limit shows error

### Fraud Detection

- [ ] Suspicious patterns blocked
- [ ] Multiple accounts flagged
- [ ] Rapid transactions flagged
- [ ] Large amounts trigger review
- [ ] User can appeal

### Smart Contract

- [ ] Only authorized processor can complete
- [ ] Only authorized processor can refund
- [ ] User can cancel before processing
- [ ] Emergency refund after 15 min
- [ ] Refund returns exact amount

---

## 🐛 Bug Reporting Template

When you find a bug, document it like this:

```
**Bug**: [Short description]

**Steps to Reproduce**:
1.
2.
3.

**Expected**:
**Actual**:

**Environment**:
- Browser:
- Chain:
- Wallet:

**Screenshots/Logs**:
```

---

## ✅ Sign-Off

Once all tests pass:

- [ ] All functional tests passed
- [ ] All edge cases handled
- [ ] All integration tests passed
- [ ] UI/UX tests passed
- [ ] Security tests passed
- [ ] Bugs documented and fixed
- [ ] Ready for staging deployment

**Tested by**: ******\_\_\_******  
**Date**: ******\_\_\_******  
**Environment**: Alfajores Testnet / Celo Mainnet  
**Verdict**: ✅ PASS / ❌ FAIL

---

_Use this checklist systematically to ensure the spend flow is production-ready._
