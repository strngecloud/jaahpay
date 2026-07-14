/**
 * Sweep accumulated platform fees out of the FeeCollector.
 *
 * Reads the router's current feeCollector, reports balances, and (with
 * EXECUTE=1) withdraws whatever FeeCollector.withdrawFees() will allow.
 *
 * KNOWN LIMITATION of the deployed FeeCollector: the router sends ERC20 fees
 * with a plain transfer, which never updates the `collectedFees` accounting
 * that withdrawFees() checks — so ERC20 fees show up in balanceOf() but are
 * NOT withdrawable ("stuck"). This script reports the stuck amount loudly.
 * Fix options are documented in docs/ARB_BOT.md.
 *
 * Usage:
 *   pnpm bot:sweep              # report only
 *   EXECUTE=1 pnpm bot:sweep    # withdraw what's withdrawable (needs owner PRIVATE_KEY)
 *
 * Env: PRIVATE_KEY (FeeCollector owner), SWEEP_TO (default: owner address)
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
  const { SWAP_TOKENS, JAHPAY_ROUTER_ADDRESS } = await import('../src/lib/minipay/constants');
  type Address = `0x${string}`;

  const execute = process.env.EXECUTE === '1';
  const rpcUrl = process.env.ARB_RPC_URL || 'https://forno.celo.org';
  const privateKey = process.env.PRIVATE_KEY;

  const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });
  const account = privateKey
    ? privateKeyToAccount((privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Address)
    : null;
  const sweepTo = (process.env.SWEEP_TO || account?.address) as Address | undefined;

  const ROUTER_ABI = [
    { name: 'feeCollector', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  ] as const;
  const FEE_COLLECTOR_ABI = [
    { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    {
      name: 'collectedFees',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'token', type: 'address' }],
      outputs: [{ type: 'uint256' }],
    },
    {
      name: 'withdrawFees',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'token', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [],
    },
  ] as const;
  const ERC20_ABI = [
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'owner', type: 'address' }],
      outputs: [{ type: 'uint256' }],
    },
  ] as const;

  const feeCollector = (await publicClient.readContract({
    address: JAHPAY_ROUTER_ADDRESS as Address,
    abi: ROUTER_ABI,
    functionName: 'feeCollector',
  })) as Address;

  console.log(`router:       ${JAHPAY_ROUTER_ADDRESS}`);
  console.log(`feeCollector: ${feeCollector}`);
  console.log(`mode:         ${execute ? 'EXECUTE' : 'report only (EXECUTE=1 to withdraw)'}`);

  const code = await publicClient.getCode({ address: feeCollector });
  const isContract = !!code && code !== '0x';

  const tokens: { symbol: string; address: Address; decimals: number }[] = [
    { symbol: 'CELO (native)', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
    ...SWAP_TOKENS.filter((t) => t.symbol !== 'CELO').map((t) => ({
      symbol: t.symbol,
      address: t.address as Address,
      decimals: t.decimals,
    })),
  ];

  if (!isContract) {
    console.log('\nfeeCollector is an EOA — fees land directly in that wallet, nothing to sweep:');
    for (const t of tokens) {
      const bal =
        t.address === '0x0000000000000000000000000000000000000000'
          ? await publicClient.getBalance({ address: feeCollector })
          : await publicClient.readContract({ address: t.address, abi: ERC20_ABI, functionName: 'balanceOf', args: [feeCollector] });
      console.log(`  ${t.symbol}: ${formatUnits(bal, t.decimals)}`);
    }
    return;
  }

  const owner = (await publicClient.readContract({
    address: feeCollector,
    abi: FEE_COLLECTOR_ABI,
    functionName: 'owner',
  })) as Address;
  console.log(`FC owner:     ${owner}`);
  if (execute && (!account || account.address.toLowerCase() !== owner.toLowerCase())) {
    console.error('EXECUTE=1 but PRIVATE_KEY is missing or is not the FeeCollector owner — aborting.');
    process.exit(1);
  }

  const walletClient = account ? createWalletClient({ account, chain: celo, transport: http(rpcUrl) }) : null;
  let totalStuck = false;

  for (const t of tokens) {
    const isNative = t.address === '0x0000000000000000000000000000000000000000';
    const actual = isNative
      ? await publicClient.getBalance({ address: feeCollector })
      : ((await publicClient.readContract({
          address: t.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [feeCollector],
        })) as bigint);
    const collected = (await publicClient.readContract({
      address: feeCollector,
      abi: FEE_COLLECTOR_ABI,
      functionName: 'collectedFees',
      args: [t.address],
    })) as bigint;

    const withdrawable = collected < actual ? collected : actual;
    const stuck = actual - withdrawable;
    console.log(
      `\n${t.symbol}: balance ${formatUnits(actual, t.decimals)} | accounted ${formatUnits(collected, t.decimals)} | withdrawable ${formatUnits(withdrawable, t.decimals)}`,
    );
    if (stuck > 0n) {
      totalStuck = true;
      console.warn(`  ⚠ ${formatUnits(stuck, t.decimals)} ${t.symbol} is STUCK (transferred without collectFees accounting).`);
    }

    if (execute && walletClient && withdrawable > 0n && sweepTo) {
      const hash = await walletClient.writeContract({
        address: feeCollector,
        abi: FEE_COLLECTOR_ABI,
        functionName: 'withdrawFees',
        args: [t.address, sweepTo, withdrawable],
        account: account!,
        chain: celo,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  swept ${formatUnits(withdrawable, t.decimals)} ${t.symbol} → ${sweepTo}: ${hash} (${receipt.status})`);
    }
  }

  if (totalStuck) {
    console.warn(
      '\n⚠ ERC20 fees are accumulating unwithdrawably. Recommended fix: point the router at a wallet you control:\n' +
        `  cast send ${JAHPAY_ROUTER_ADDRESS} "setFeeCollector(address)" <YOUR_WALLET> --rpc-url ${rpcUrl} --private-key $PRIVATE_KEY\n` +
        '(or redeploy a FeeCollector with a balance-based sweep function). See docs/ARB_BOT.md.',
    );
  }
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
