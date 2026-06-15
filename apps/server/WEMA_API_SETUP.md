# Wema Bank API Integration Guide

## Overview

This document explains how to integrate with Wema Bank's Funds Transfer OpenAPI for processing bank transfers in the spending feature.

## API Endpoints

### Base URL

```
https://wema-alatdev-apimgt.azure-api.net/funds-transfer-open/api
```

### Available Endpoints

1. **Get All Banks**
   - URL: `GET /OpenApiTransfer/GetAllBanks`
   - Purpose: Retrieve list of all supported banks
   - Auth: Subscription Key only

2. **Account Name Enquiry**
   - URL: `GET /Shared/AccountNameEnquiry/{bankCode}/{accountNumber}`
   - Purpose: Validate account and retrieve account holder name
   - Auth: Subscription Key only

3. **Transfer Funds**
   - URL: `POST /OpenApiTransfer/transfer-fund-request`
   - Purpose: Initiate a bank transfer
   - Auth: Subscription Key + Hash header

## Authentication

### Subscription Key

All requests require the `Ocp-Apim-Subscription-Key` header with your Primary or Secondary subscription key.

### Hash Computation (Transfer Only)

Transfer requests require an additional `hash` header computed using HmacSHA512.

**Hash Format:**

```
transactionReference + destinationBankCode + destinationAccountNumber + sourceAccountNumber + amount
```

**Example (Node.js):**

```javascript
const crypto = require('crypto');

function computeHash(
  reference,
  bankCode,
  accountNumber,
  sourceAccount,
  amount,
  saltKey,
) {
  const message = `${reference}${bankCode}${accountNumber}${sourceAccount}${amount}`;
  const hmac = crypto.createHmac('sha512', saltKey);
  hmac.update(message);
  return hmac.digest('hex');
}
```

## Required Environment Variables

Add these to your `.env` file:

```bash
# Wema API Configuration
WEMA_API_URL=https://wema-alatdev-apimgt.azure-api.net/funds-transfer-open/api
WEMA_API_KEY=<your_primary_subscription_key>
WEMA_SALT_KEY=<salt_key_provided_by_wema>
WEMA_SOURCE_ACCOUNT=<your_wema_account_number>
WEMA_CALLBACK_URL=<your_callback_endpoint_url>

# Backup keys
WEMA_PRIMARY_KEY=<your_primary_subscription_key>
WEMA_SECONDARY_KEY=<your_secondary_subscription_key>
```

### Where to Get These Values

1. **Subscription Keys (PRIMARY/SECONDARY)**
   - Login to: https://wema-alatdev-apimgt.developer.azure-api.net/
   - Go to Profile
   - Find "Funds Transfer OpenAPI" subscription
   - Click "Show" to reveal keys

2. **Salt Key**
   - Contact Wema Bank support
   - This is a secret key used for HMAC computation

3. **Source Account**
   - Your Wema Bank account number
   - This is the account from which funds will be debited

4. **Callback URL**
   - Your server endpoint to receive transaction status updates
   - Must be publicly accessible
   - See "Callback Implementation" section below

## Transfer Request Flow

1. **Initial Request**
   - Your application sends transfer request with hash
   - Wema API validates the hash
   - Returns "Pending" status immediately

2. **Async Processing**
   - Wema processes the transfer asynchronously
   - Final status sent to your callback URL

3. **Callback Notification**
   - Wema POSTs transaction result to your callback URL
   - Your application updates transaction status

## Callback Implementation

### Endpoint Requirements

- Must accept POST requests
- Must be publicly accessible (HTTPS recommended)
- Must respond quickly (acknowledge receipt)

### Callback Payload Structure

```json
{
  "Title": "string",
  "Message": "string",
  "Data": {
    "result": {
      "status": "string",
      "message": "string",
      "narration": "string",
      "transactionReference": "string",
      "platformTransactionReference": "string",
      "transactionStan": "string"
    },
    "errorMessage": "string",
    "errorMessages": ["string"],
    "hasError": true,
    "timeGenerated": "2020-10-22T10:40:13.961Z"
  },
  "Request": 4
}
```

### Request Parameter Values

- `1` = WalletCreation
- `2` = AccountCreation
- `3` = PinValidation
- `4` = PaymentResponse (your use case)

### Example Callback Handler (NestJS)

```typescript
@Post('/wema/callback')
async handleWemaCallback(@Body() payload: WemaCallbackDto) {
    this.logger.log('Received Wema callback');

    if (payload.Request === 4) { // PaymentResponse
        const result = payload.Data.result;

        // Update your transaction status
        await this.updateTransactionStatus(
            result.transactionReference,
            result.status,
            result.platformTransactionReference
        );
    }

    return { success: true };
}
```

## Testing

### 1. Test API Connectivity

```bash
node apps/server/test-wema-api.js
```

This tests:

- Get all banks
- Account name enquiry
- Basic connectivity

### 2. Test Transfer (requires salt key)

```bash
node apps/server/test-wema-transfer.js
```

This tests:

- Hash computation
- Transfer request
- Full flow

## Transaction Statuses

Based on the API documentation:

1. **Pending** - Initial status after successful submission
2. **Success** - Transfer completed successfully
3. **Failed** - Transfer failed
4. **Processing** - Transfer is being processed

## Error Handling

### Common Errors

1. **"Hash should not be empty. Access denied."**
   - Missing or invalid hash header
   - Check WEMA_SALT_KEY configuration
   - Verify hash computation logic

2. **"Account not found"**
   - Invalid account number or bank code
   - Use Account Name Enquiry endpoint first

3. **401/403 Unauthorized**
   - Invalid or expired subscription key
   - Check WEMA_API_KEY configuration

4. **404 Not Found**
   - Incorrect API endpoint URL
   - Verify base URL configuration

## Security Best Practices

1. **Protect Your Keys**
   - Never commit `.env` to version control
   - Use secrets management in production
   - Rotate keys periodically

2. **Validate Callbacks**
   - Verify callback source (IP whitelist)
   - Validate payload structure
   - Log all callbacks for audit

3. **Hash Computation**
   - Always use server-side computation
   - Never expose salt key to client
   - Validate all inputs before hashing

## Production Checklist

- [ ] Obtain production subscription keys
- [ ] Get salt key from Wema
- [ ] Configure production source account
- [ ] Set up callback endpoint (HTTPS)
- [ ] Implement callback handler
- [ ] Test in Wema sandbox environment
- [ ] Enable production logging
- [ ] Set up monitoring and alerts
- [ ] Document error handling procedures
- [ ] Implement retry logic for failed transfers

## Support

For API issues or questions:

- Contact: Wema Bank API Support
- Portal: https://wema-alatdev-apimgt.developer.azure-api.net/
- Documentation: Check API portal for latest updates
