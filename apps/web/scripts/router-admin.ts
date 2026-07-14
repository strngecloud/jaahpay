/**
 * JahpaySwapRouter owner operations: lower the platform fee and point the
 * fee collector at a wallet you can actually withdraw from.
 *
 * Dry-run by default — prints current on-chain state and what would change.
 *
 * Usage:
 *   pnpm router:admin                # dry-run report
 *   EXECUTE=1 pnpm router:admin      # send the owner txs
 *
 * Env (apps/web/.env / .env.local):
 *   PRIVATE_KEY            router owner key
 *   ROUTER_FEE_BPS         target platform fee in bps (default 1 = 0.01%);
 *                          keep in sync with PLATFORM_FEE_BPS in
 *                          src/lib/minipay/constants.ts
 *   ROUTER_FEE_COLLECTOR   target fee collector (default: the owner wallet —
 *                          an EOA, so ERC20 fees can never get stuck in the
 *                          FeeCollector contract's accounting)
 *   ARB_RPC_URL            RPC override (default https://forno.celo.org)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

import { createPublicClient, createWalletClient, http, getAddress } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.ARB_RPC_URL || 'https://forno.celo.org';
const EXECUTE = process.env.EXECUTE === '1';
const ROUTER = (process.env.NEXT_PUBLIC_JAHPAY_ROUTER_ADDRESS ||
  '0x8d5b244f9e16df261b1fb575c498028cc3211d3a') as `0x${string}`;

const abi = [
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'platformFeeBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'feeCollector', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'setPlatformFee', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_feeBps', type: 'uint256' }], outputs: [] },
  { name: 'setFeeCollector', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_feeCollector', type: 'address' }], outputs: [] },
] as const;

async function main() {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error('PRIVATE_KEY not set');
  const account = privateKeyToAccount(key as `0x${string}`);

  const targetFeeBps = BigInt(process.env.ROUTER_FEE_BPS || '1');
  const targetCollector = getAddress(process.env.ROUTER_FEE_COLLECTOR || account.address);

  const pc = createPublicClient({ chain: celo, transport: http(RPC) });
  const wc = createWalletClient({ account, chain: celo, transport: http(RPC) });

  const [owner, feeBps, collector] = await Promise.all([
    pc.readContract({ address: ROUTER, abi, functionName: 'owner' }),
    pc.readContract({ address: ROUTER, abi, functionName: 'platformFeeBps' }),
    pc.readContract({ address: ROUTER, abi, functionName: 'feeCollector' }),
  ]);

  console.log(`router          ${ROUTER}`);
  console.log(`owner           ${owner}${owner.toLowerCase() === account.address.toLowerCase() ? ' (you)' : ' (NOT you — txs will revert)'}`);
  console.log(`platformFeeBps  ${feeBps} -> ${targetFeeBps}${feeBps === targetFeeBps ? ' (no change)' : ''}`);
  console.log(`feeCollector    ${collector} -> ${targetCollector}${collector.toLowerCase() === targetCollector.toLowerCase() ? ' (no change)' : ''}`);

  if (!EXECUTE) {
    console.log('\nDry-run. Set EXECUTE=1 to send the owner transactions.');
    return;
  }

  if (feeBps !== targetFeeBps) {
    const tx = await wc.writeContract({ address: ROUTER, abi, functionName: 'setPlatformFee', args: [targetFeeBps] });
    await pc.waitForTransactionReceipt({ hash: tx });
    console.log(`setPlatformFee(${targetFeeBps}) -> ${tx}`);
  }
  if (collector.toLowerCase() !== targetCollector.toLowerCase()) {
    const tx = await wc.writeContract({ address: ROUTER, abi, functionName: 'setFeeCollector', args: [targetCollector] });
    await pc.waitForTransactionReceipt({ hash: tx });
    console.log(`setFeeCollector(${targetCollector}) -> ${tx}`);
  }

  const [newFee, newCollector] = await Promise.all([
    pc.readContract({ address: ROUTER, abi, functionName: 'platformFeeBps' }),
    pc.readContract({ address: ROUTER, abi, functionName: 'feeCollector' }),
  ]);
  console.log(`\nnow: platformFeeBps=${newFee} feeCollector=${newCollector}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
