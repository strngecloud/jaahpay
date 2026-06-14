const axios = require('axios');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config();

const WEMA_API_KEY = process.env.WEMA_API_KEY;
const WEMA_SALT_KEY = process.env.WEMA_SALT_KEY || 'YOUR_SALT_KEY_HERE';
const WEMA_SOURCE_ACCOUNT = process.env.WEMA_SOURCE_ACCOUNT || '0000000000';
const BASE_URL = 'https://wema-alatdev-apimgt.azure-api.net/funds-transfer-open/api';

console.log('Testing Wema Transfer API...');
console.log('API Key:', WEMA_API_KEY ? `${WEMA_API_KEY.substring(0, 8)}...` : 'NOT SET');
console.log('Salt Key:', WEMA_SALT_KEY !== 'YOUR_SALT_KEY_HERE' ? 'Configured' : 'NOT SET');
console.log('Source Account:', WEMA_SOURCE_ACCOUNT);

/**
 * Compute HMAC SHA512 hash for transfer requests
 * Format: transactionReference + destinationBankCode + destinationAccountNumber + sourceAccountNumber + amount
 */
function computeHash(transactionReference, destinationBankCode, destinationAccountNumber, sourceAccountNumber, amount) {
    const message = `${transactionReference}${destinationBankCode}${destinationAccountNumber}${sourceAccountNumber}${amount}`;
    console.log('\nHash Computation:');
    console.log('Message:', message);
    
    const hmac = crypto.createHmac('sha512', WEMA_SALT_KEY);
    hmac.update(message);
    const hash = hmac.digest('hex');
    
    console.log('Hash:', hash.substring(0, 20) + '...');
    return hash;
}

async function testTransfer() {
    const headers = {
        'Ocp-Apim-Subscription-Key': WEMA_API_KEY,
        'Content-Type': 'application/json',
    };

    // Test Transfer Fund Request
    try {
        console.log('\n💸 Testing Transfer Fund Request...');
        
        if (WEMA_SALT_KEY === 'YOUR_SALT_KEY_HERE') {
            console.log('⚠️  WEMA_SALT_KEY is not configured. Please set it in .env file.');
            console.log('This is required to compute the hash for transfer requests.');
            return;
        }

        const transferPayload = {
            amount: 100,
            narration: 'Test transfer from API',
            transactionReference: `TEST_${Date.now()}`,
            destinationBankCode: '035',
            destinationBankName: 'WEMA BANK',
            destinationAccountNumber: '0123456789',
            destinationAccountName: 'Test Account',
            sourceAccountNumber: WEMA_SOURCE_ACCOUNT,
        };

        console.log('\nTransfer Payload:');
        console.log(JSON.stringify(transferPayload, null, 2));

        // Compute hash
        const hash = computeHash(
            transferPayload.transactionReference,
            transferPayload.destinationBankCode,
            transferPayload.destinationAccountNumber,
            transferPayload.sourceAccountNumber,
            transferPayload.amount
        );

        headers['hash'] = hash;

        console.log('\nSending request...');
        const response = await axios.post(
            `${BASE_URL}/OpenApiTransfer/transfer-fund-request`,
            transferPayload,
            { headers, timeout: 30000 }
        );

        console.log('\n✅ Response received!');
        console.log('Successful:', response.data.successful);
        console.log('Message:', response.data.message);
        console.log('Status:', response.data.result?.status);
        console.log('Platform Reference:', response.data.result?.platformTransactionReference);
        console.log('\nFull Response:');
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('\n❌ Transfer failed!');
        console.error('Error:', error.message);
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Instructions
console.log('\n' + '='.repeat(60));
console.log('SETUP REQUIRED:');
console.log('1. Set WEMA_SALT_KEY in .env (provided by Wema)');
console.log('2. Set WEMA_SOURCE_ACCOUNT in .env (your Wema account)');
console.log('3. Ensure destination account exists for testing');
console.log('='.repeat(60));

testTransfer();
