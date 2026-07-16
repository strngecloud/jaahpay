/**
 * Recycle USDC from the x402 RECEIVER wallet back to the SENDER wallet.
 *
 * The x402 consumer agent (pnpm bot:x402) pays USDC from the sender wallet
 * (X402_AGENT_PRIVATE_KEY) to the receiver wallet (X402_PAYTO_ADDRESS). To keep
 * banking hackathon volume without needing fresh capital, this script sweeps the
 * USDC that piled up in the receiver back to the sender so it can be spent again.
 *
 * The receiver wallet key is PRIVATE_KEY (the registered allowlist wallet, e.g.
 * 0x3E19…2d63). The sender address is derived from X402_AGENT_PRIVATE_KEY, or set
 * explicitly with RECYCLE_TO.
 *
 * Usage:
 *   pnpm bot:recycle              # report only — shows receiver USDC balance
 *   EXECUTE=1 pnpm bot:recycle    # send the full USDC balance back to the sender
 *
 * Env:
 *   PRIVATE_KEY            receiver wallet key (holds the received USDC)
 *   X402_AGENT_PRIVATE_KEY sender wallet key (used to derive the destination)
 *   RECYCLE_TO             optional — destination address (overrides the above)
 *   RECYCLE_KEEP_ATOMIC    optional — USDC atomic units to leave behind (default 0)
 *   ARB_RPC_URL            optional — Celo RPC (default forno)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

async function main() {
  const { createPublicClient, createWalletClient, http, formatUnits } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { celo } = await import('viem/chains');
  type Address = `0x${string}`;

  const USDC: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'; // Celo mainnet, 6 decimals
  const DECIMALS = 6;

  const execute = process.env.EXECUTE === '1';
  const rpcUrl = process.env.ARB_RPC_URL || 'https://forno.celo.org';
  const keep = BigInt(process.env.RECYCLE_KEEP_ATOMIC || '0');

  const norm = (k?: string) => (k ? ((k.startsWith('0x') ? k : `0x${k}`) as Address) : undefined);
  const receiverKey = norm(process.env.PRIVATE_KEY);
  if (!receiverKey) {
    console.error('Set PRIVATE_KEY (the receiver / registered wallet key) in apps/web/.env');
    process.exit(1);
  }
  const receiver = privateKeyToAccount(receiverKey);

  // Destination = explicit RECYCLE_TO, else the sender address derived from its key.
  let to = process.env.RECYCLE_TO as Address | undefined;
  if (!to) {
    const senderKey = norm(process.env.X402_AGENT_PRIVATE_KEY);
    if (senderKey) to = privateKeyToAccount(senderKey).address;
  }
  if (!to) {
    console.error('Set RECYCLE_TO (sender address) or X402_AGENT_PRIVATE_KEY so the destination can be derived.');
    process.exit(1);
  }
  if (to.toLowerCase() === receiver.address.toLowerCase()) {
    console.error('Destination equals the receiver — nothing to recycle. Sender and receiver must differ.');
    process.exit(1);
  }

  const ERC20_ABI = [
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
    { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  ] as const;

  const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });

  const balance = (await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [receiver.address],
  })) as bigint;

  const amount = balance > keep ? balance - keep : 0n;

  console.log(`receiver:  ${receiver.address}`);
  console.log(`sender:    ${to}`);
  console.log(`USDC bal:  ${formatUnits(balance, DECIMALS)}`);
  console.log(`keep:      ${formatUnits(keep, DECIMALS)}`);
  console.log(`to send:   ${formatUnits(amount, DECIMALS)}`);
  console.log(`mode:      ${execute ? 'EXECUTE' : 'report only (EXECUTE=1 to send)'}`);

  if (!execute) return;
  if (amount === 0n) {
    console.log('Nothing to send.');
    return;
  }

  const walletClient = createWalletClient({ account: receiver, chain: celo, transport: http(rpcUrl) });
  const hash = await walletClient.writeContract({
    address: USDC, abi: ERC20_ABI, functionName: 'transfer', args: [to, amount], account: receiver, chain: celo,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`sent ${formatUnits(amount, DECIMALS)} USDC → ${to}: ${hash} (${receipt.status})`);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
