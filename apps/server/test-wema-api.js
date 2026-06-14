const axios = require('axios');

// Load environment variables
require('dotenv').config();

const WEMA_API_KEY = process.env.WEMA_API_KEY;
const BASE_URL = 'https://wema-alatdev-apimgt.azure-api.net/funds-transfer-open/api';

console.log('Testing Wema API Connection...');
console.log('API Key:', WEMA_API_KEY ? `${WEMA_API_KEY.substring(0, 8)}...` : 'NOT SET');

async function testWemaAPI() {
    const headers = {
        'Ocp-Apim-Subscription-Key': WEMA_API_KEY,
    };

    // Test 1: Get All Banks
    try {
        console.log('\n📋 Test 1: Getting list of banks...');
        const response = await axios.get(
            `${BASE_URL}/OpenApiTransfer/GetAllBanks`,
            { headers, timeout: 10000 }
        );

        console.log('✅ Success!');
        console.log(`Found ${response.data.result?.length || 0} banks`);
        if (response.data.result?.length > 0) {
            console.log('Sample banks:', response.data.result.slice(0, 3).map(b => b.bankName).join(', '));
        }
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }

    // Test 2: Account Name Enquiry
    try {
        console.log('\n👤 Test 2: Account name enquiry...');
        const bankCode = '035'; // Wema Bank
        const accountNumber = '0123456789'; // Test account
        
        console.log(`Checking: ${accountNumber} at bank ${bankCode}`);
        const response = await axios.get(
            `${BASE_URL}/Shared/AccountNameEnquiry/${bankCode}/${accountNumber}`,
            { headers, timeout: 15000 }
        );

        if (response.data.successful) {
            console.log('✅ Success!');
            console.log('Account Name:', response.data.result?.accountName);
        } else {
            console.log('⚠️ Response:', response.data.message || 'Account not found');
        }
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }

    // Test 3: Transfer Fund Request (NOTE: This will likely fail without valid source account)
    try {
        console.log('\n💸 Test 3: Transfer fund request (dry run)...');
        console.log('Note: This test will likely fail without a valid source account configured');
        
        const transferPayload = {
            destinationAccountNumber: '0123456789',
            destinationBankCode: '035',
            amount: 100,
            narration: 'Test transfer',
            reference: `TEST_${Date.now()}`,
        };

        console.log('Payload:', transferPayload);
        const response = await axios.post(
            `${BASE_URL}/OpenApiTransfer/transfer-fund-request`,
            transferPayload,
            { 
                headers: { ...headers, 'Content-Type': 'application/json' },
                timeout: 30000 
            }
        );

        if (response.data.successful) {
            console.log('✅ Success!');
            console.log('Response:', response.data);
        } else {
            console.log('⚠️ Failed:', response.data.message);
        }
    } catch (error) {
        console.error('❌ Expected error (no source account):', error.response?.data || error.message);
    }

    console.log('\n✅ API testing complete!');
}

testWemaAPI();
