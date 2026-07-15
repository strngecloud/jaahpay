/**
 * Create (or rotate) an API key for the Celo x402 facilitator.
 *
 * The facilitator's /settle endpoint requires an X-API-Key. Keys are
 * self-serve at x402.celo.org: prove wallet ownership with a gas-free
 * signature and the portal returns your key. This script automates that.
 *
 * Usage:
 *   pnpm x402:keygen              # create a key for PRIVATE_KEY's wallet
 *   ROTATE=1 pnpm x402:keygen     # regenerate (invalidates the old key)
 *
 * Then set the printed key as X402_FACILITATOR_API_KEY in apps/web/.env
 * AND in Vercel's env for the deployed site, and redeploy.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

import { privateKeyToAccount } from 'viem/accounts';

const PORTAL = 'https://x402.celo.org';
const ROTATE = process.env.ROTATE === '1';

async function main() {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error('PRIVATE_KEY not set in apps/web/.env');
  const account = privateKeyToAccount(key as `0x${string}`);
  console.log(`wallet: ${account.address}`);

  const acct = await fetch(`${PORTAL}/api/account?address=${account.address}`).then((r) =>
    r.json()
  );
  console.log(`account exists: ${acct.exists}${acct.apiKeyPrefix ? ` (key ${acct.apiKeyPrefix}…)` : ''}`);
  if (acct.balances) console.log('balances:', JSON.stringify(acct.balances));

  const { nonce } = await fetch(`${PORTAL}/api/keys/nonce`).then((r) => r.json());

  const message = ROTATE
    ? `x402.celo.org wants you to regenerate your x402 API key.\n\nAddress: ${account.address}\nNonce: ${nonce}\n\nThis invalidates your previous key. Signing costs no gas and sends no transaction.`
    : `x402.celo.org wants you to create an x402 API key.\n\nAddress: ${account.address}\nNonce: ${nonce}\n\nSigning this message proves you control this wallet. It costs no gas and sends no transaction.`;

  const signature = await account.signMessage({ message });

  const res = await fetch(`${PORTAL}/api/keys${ROTATE ? '/rotate' : ''}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: account.address, nonce, signature }),
  });
  const data = await res.json();
  if (!res.ok || !data.apiKey) {
    throw new Error(`key creation failed (${res.status}): ${JSON.stringify(data)}`);
  }

  console.log('\nAPI key (copy now — it is only shown once):\n');
  console.log(`  X402_FACILITATOR_API_KEY=${data.apiKey}\n`);
  if (data.balances) console.log('facilitator balances:', JSON.stringify(data.balances));
  console.log(
    'Add the line above to apps/web/.env AND to Vercel env for the deployed site, then redeploy.'
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
