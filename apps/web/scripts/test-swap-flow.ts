import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MOCK_USER = '0x1111111111111111111111111111111111111111';

async function runAll() {
  try {
    // Dynamically import libraries AFTER dotenv.config() has run
    const { getSwapQuote, buildSwapTransaction } = await import('../src/lib/swap/usdc-usdt-swap');
    const { getUniswapQuote, buildUniswapSwapTransaction } = await import('../src/lib/swap/uniswap-swap');
    const { JAHPAY_ROUTER_ADDRESS, PLATFORM_FEE_BPS } = await import('../src/lib/minipay/constants');



    console.log('--- Testing Mento Swap Flow (USDC ↔ USDT) ---');
    console.log('Fetching USDC -> USDT quote...');
    const amountIn = '10.0';
    const quote = await getSwapQuote('USDC', 'USDT', amountIn);
    
    console.log(`Quote details:`);
    console.log(`- Amount In: ${quote.amountIn} USDC`);
    console.log(`- Gross Out: ${quote.amountOutGross} USDT`);
    console.log(`- Platform Fee: ${quote.platformFee} USDT`);
    console.log(`- Net Out: ${quote.amountOutNet} USDT`);
    console.log(`- Rate: ${quote.rate}`);
    
    const grossBig = BigInt(Math.round(parseFloat(quote.amountOutGross) * 10**6));
    const expectedFeeBig = (grossBig * BigInt(PLATFORM_FEE_BPS)) / 10000n;
    const actualFeeBig = BigInt(Math.round(parseFloat(quote.platformFee) * 10**6));
    
    if (Math.abs(Number(expectedFeeBig - actualFeeBig)) > 1) {
      throw new Error(`Fee calculation mismatch! Expected around ${expectedFeeBig}, got ${actualFeeBig}`);
    }
    console.log('✅ Fee math verified.');

    console.log('Building transaction payload...');
    const tx = await buildSwapTransaction('USDC', 'USDT', amountIn, MOCK_USER);
    
    console.log(`Target Address: ${tx.swap.params.to}`);
    if (tx.swap.params.to.toLowerCase() !== JAHPAY_ROUTER_ADDRESS.toLowerCase()) {
      throw new Error(`Target address should be JAHPAY_ROUTER_ADDRESS (${JAHPAY_ROUTER_ADDRESS}), got ${tx.swap.params.to}`);
    }
    console.log('✅ Transaction destination verified (JahpaySwapRouter).');
    
    if (!tx.swap.params.data || !tx.swap.params.data.startsWith('0x')) {
      throw new Error('Calldata is invalid or empty.');
    }
    console.log('✅ Calldata verified.');

    console.log('\n--- Testing Uniswap Swap Flow (CELO ↔ USDC) ---');
    console.log('Fetching CELO -> USDC quote...');
    const celoAmountIn = '2.0';
    const uniQuote = await getUniswapQuote('CELO', 'USDC', celoAmountIn);
    
    console.log(`Quote details:`);
    console.log(`- Amount In: ${uniQuote.amountIn} CELO`);
    console.log(`- Gross Out: ${uniQuote.amountOutGross} USDC`);
    console.log(`- Platform Fee: ${uniQuote.platformFee} USDC`);
    console.log(`- Net Out: ${uniQuote.amountOutNet} USDC`);
    console.log(`- Rate: ${uniQuote.rate}`);
    
    const grossUniBig = BigInt(Math.round(parseFloat(uniQuote.amountOutGross) * 10**6));
    const expectedFeeUniBig = (grossUniBig * BigInt(PLATFORM_FEE_BPS)) / 10000n;
    const actualFeeUniBig = BigInt(Math.round(parseFloat(uniQuote.platformFee) * 10**6));
    
    if (Math.abs(Number(expectedFeeUniBig - actualFeeUniBig)) > 1) {
      throw new Error(`Fee calculation mismatch! Expected around ${expectedFeeUniBig}, got ${actualFeeUniBig}`);
    }
    console.log('✅ Fee math verified.');

    console.log('Building transaction payload...');
    const uniTx = await buildUniswapSwapTransaction('CELO', 'USDC', celoAmountIn, MOCK_USER);
    
    console.log(`Target Address: ${uniTx.swap.params.to}`);
    if (uniTx.swap.params.to.toLowerCase() !== JAHPAY_ROUTER_ADDRESS.toLowerCase()) {
      throw new Error(`Target address should be JAHPAY_ROUTER_ADDRESS (${JAHPAY_ROUTER_ADDRESS}), got ${uniTx.swap.params.to}`);
    }
    
    console.log(`Value to send: ${uniTx.swap.params.value}`);
    if (!uniTx.swap.params.value || BigInt(uniTx.swap.params.value) === 0n) {
      throw new Error(`Value should be greater than 0 for native CELO swap.`);
    }
    console.log('✅ Transaction destination and value verified.');

    console.log('\n🎉 ALL FRONTEND SWAP FLOW TESTS PASSED!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

runAll();
