/**
 * Jahpay autonomous x402 consumer agent.
 *
 * A real x402 client: it discovers Jahpay's paid API catalog, then buys and
 * uses the services end-to-end on an interval — pays USDC on Celo mainnet
 * per request via EIP-3009 transferWithAuthorization, settled on-chain by
 * the Celo facilitator (which relays the tx and pays gas). Each cycle it
 * purchases a live market snapshot and an AI swap recommendation and logs
 * the intelligence it bought plus the settlement tx hash.
 *
 * This exercises the exact flow third-party agents use (402 → sign → retry
 * → X-PAYMENT-RESPONSE receipt), so it doubles as a continuous production
 * health check of the paywall + facilitator pipeline.
 *
 * Usage:
 *   pnpm bot:x402                 # continuous (default: one purchase/cycle)
 *   X402_AGENT_ONCE=1 pnpm bot:x402  # single round, then exit (smoke test)
 *
 * Env (apps/web/.env / .env.local):
 *   X402_AGENT_PRIVATE_KEY  payer wallet key (falls back to PRIVATE_KEY);
 *                           needs a little USDC — each call costs ≤ $0.001
 *   X402_TARGET_URL         API origin to buy from (default https://jahpay.xyz)
 *   X402_AGENT_POLL_MS      ms between purchases (default 60000)
 *   X402_MAX_PRICE_ATOMIC   refuse offers above this many USDC atomic units
 *                           (default 10000 = $0.01) — safety cap
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

import { privateKeyToAccount } from 'viem/accounts';
import { toHex } from 'viem';
import { randomBytes } from 'crypto';

const TARGET = (process.env.X402_TARGET_URL || 'https://jahpay.xyz').replace(/\/$/, '');
const POLL_MS = Number(process.env.X402_AGENT_POLL_MS || 60_000);
const MAX_PRICE = BigInt(process.env.X402_MAX_PRICE_ATOMIC || '10000'); // $0.01
const ONCE = process.env.X402_AGENT_ONCE === '1';

const key = process.env.X402_AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!key) {
  console.error('Set X402_AGENT_PRIVATE_KEY (or PRIVATE_KEY) in apps/web/.env');
  process.exit(1);
}
const account = privateKeyToAccount(key as `0x${string}`);

interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: { name?: string; version?: string };
}

/** The services this agent actually consumes each cycle, cheapest first. */
const SHOPPING_LIST: Array<{ label: string; path: string; init: RequestInit }> = [
  {
    label: 'market snapshot',
    path: '/api/swap/rates',
    init: { method: 'GET' },
  },
  {
    label: 'mento quote USDC→USDT',
    path: '/api/providers/mento-quotes?from=USDC&to=USDT&amount=100',
    init: { method: 'GET' },
  },
  {
    label: 'AI swap recommendation',
    path: '/api/agent/recommendation?x402=pay',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: '100', fromToken: 'USDC', chainId: 42220 }),
    },
  },
];

/** Sign an EIP-3009 transferWithAuthorization for the offered requirements. */
async function buildPaymentHeader(req: PaymentRequirements): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: account.address,
    to: req.payTo as `0x${string}`,
    value: BigInt(req.maxAmountRequired),
    validAfter: BigInt(0),
    validBefore: BigInt(now + (req.maxTimeoutSeconds || 300)),
    nonce: toHex(randomBytes(32)) as `0x${string}`,
  };

  const signature = await account.signTypedData({
    domain: {
      name: req.extra?.name || 'USDC',
      version: req.extra?.version || '2',
      chainId: 42220,
      verifyingContract: req.asset as `0x${string}`,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: authorization,
  });

  const payload = {
    x402Version: 1,
    scheme: 'exact',
    network: req.network,
    payload: {
      signature,
      authorization: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value.toString(),
        validAfter: authorization.validAfter.toString(),
        validBefore: authorization.validBefore.toString(),
        nonce: authorization.nonce,
      },
    },
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/** Buy one service: request → 402 offer → pay → receipt. */
async function buy(label: string, url: string, init: RequestInit): Promise<void> {
  const first = await fetch(url, init);
  if (first.status !== 402) {
    console.log(`  ${label}: expected 402, got ${first.status} — skipping (free or broken?)`);
    return;
  }
  const offer = (await first.json()) as { accepts?: PaymentRequirements[] };
  const req = offer.accepts?.[0];
  if (!req) throw new Error(`${label}: 402 without payment requirements`);
  if (req.network !== 'celo' || req.scheme !== 'exact') {
    throw new Error(`${label}: unsupported offer ${req.scheme}/${req.network}`);
  }
  if (BigInt(req.maxAmountRequired) > MAX_PRICE) {
    throw new Error(
      `${label}: price ${req.maxAmountRequired} exceeds cap ${MAX_PRICE} — refusing`
    );
  }

  const header = await buildPaymentHeader(req);
  const paid = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), 'X-PAYMENT': header },
  });

  if (!paid.ok) {
    const body = await paid.text();
    throw new Error(`${label}: paid request failed ${paid.status}: ${body.slice(0, 200)}`);
  }

  let receiptNote = 'no receipt header';
  const receipt = paid.headers.get('X-PAYMENT-RESPONSE');
  if (receipt) {
    try {
      const parsed = JSON.parse(Buffer.from(receipt, 'base64').toString());
      receiptNote = `settled tx ${parsed.transaction || parsed.txHash || '?'}`;
    } catch {
      receiptNote = 'unparseable receipt';
    }
  }
  const data = await paid.json().catch(() => null);
  const preview = data ? JSON.stringify(data).slice(0, 120) : '(non-JSON body)';
  console.log(
    `  ${label}: paid $${Number(req.maxAmountRequired) / 1e6} — ${receiptNote}\n    bought: ${preview}…`
  );
}

let cycle = 0;
async function run(): Promise<void> {
  console.log(`x402 consumer agent | payer ${account.address} | target ${TARGET}`);
  console.log(`price cap $${Number(MAX_PRICE) / 1e6}/call | interval ${POLL_MS}ms\n`);

  for (;;) {
    const item = SHOPPING_LIST[cycle % SHOPPING_LIST.length];
    cycle++;
    console.log(`[${new Date().toISOString()}] cycle ${cycle}`);
    try {
      await buy(item.label, `${TARGET}${item.path}`, item.init);
    } catch (err) {
      console.error(`  error: ${(err as Error).message}`);
    }
    if (ONCE && cycle >= SHOPPING_LIST.length) break;
    if (ONCE) continue;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
