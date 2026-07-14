/**
 * Jahpay autonomous arbitrage bot — Mento vs Uniswap V3 USDC/USDT on Celo.
 *
 * Every cycle it quotes both venues in both directions and executes a full
 * round trip (buy on the cheap venue, sell on the rich one) through
 * JahpaySwapRouter ONLY when the spread beats venue fees + gas + a minimum
 * edge. Both legs carry the Celo Builders attribution tag automatically
 * (appended by the shared swap builders).
 *
 * This bot never trades without a real cross-venue price discrepancy: the
 * edge check is a hard floor (clamped > 0), so it cannot be configured into
 * ping-ponging funds at a loss to inflate volume. Wash-style looping is both
 * pointless (it burns fees) and against hackathon rules.
 *
 * Usage:
 *   pnpm bot:arb              # dry-run (default): quotes + decisions, no txs
 *   ARB_EXECUTE=1 pnpm bot:arb  # live trading (requires funded ARB_BOT_PRIVATE_KEY)
 *
 * Env (apps/web/.env / .env.local):
 *   ARB_BOT_PRIVATE_KEY   wallet key (falls back to PRIVATE_KEY); needs USDC/USDT inventory + a little CELO for gas
 *   ARB_EXECUTE           "1" to send transactions; anything else = dry-run
 *   ARB_TRADE_SIZE        target size per round trip in USD (default 50)
 *   ARB_MIN_TRADE_SIZE    skip if available inventory below this (default 5)
 *   ARB_MIN_EDGE_BPS      required net edge in bps of trade size (default 5, clamped >= 1)
 *   ARB_SLIPPAGE_BPS      per-leg slippage tolerance (default 10)
 *   ARB_POLL_MS           cycle interval (default 20000)
 *   ARB_GAS_USD_PER_LEG   assumed gas cost per leg in USD (default 0.01)
 *   ARB_COUNT_PLATFORM_FEE_AS_COST
 *                         "false" to treat the router's 0.3% platform fee as
 *                         recycled (it goes to your own FeeCollector) instead
 *                         of a cost. Default "true" (conservative) — flip it
 *                         once feeCollector points somewhere you can actually
 *                         withdraw from (see docs/ARB_BOT.md).
 *   ARB_RPC_URL           RPC override (default https://forno.celo.org)
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load env BEFORE importing the swap libs — constants.ts reads process.env at import time.
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

type TokenSymbol = 'USDC' | 'USDT';

interface Venue {
  id: string;
  kind: 'mento' | 'uniswap';
  feeTier?: number;
}

// Tier 3000 exists for USDC/USDT but is a depegged dust pool — never quote it.
const VENUES: Venue[] = [
  { id: 'mento', kind: 'mento' },
  { id: 'uni-100', kind: 'uniswap', feeTier: 100 },
  { id: 'uni-500', kind: 'uniswap', feeTier: 500 },
];

const TOKEN_DECIMALS = 6;
const LOG_DIR = path.join(__dirname, '../.arb-bot');
const TRADE_LOG = path.join(LOG_DIR, 'trades.jsonl');

function envNum(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function ts(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(msg: string) {
  console.log(`[${ts()}] ${msg}`);
}

async function main() {
  const { createPublicClient, createWalletClient, http, formatUnits, parseUnits } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { celo } = await import('viem/chains');
  const { getSwapQuote, buildSwapTransaction } = await import('../src/lib/swap/usdc-usdt-swap');
  const { getUniswapQuote, buildUniswapSwapTransaction } = await import('../src/lib/swap/uniswap-swap');
  const { SWAP_TOKENS, JAHPAY_ROUTER_ADDRESS, PLATFORM_FEE_BPS } = await import('../src/lib/minipay/constants');
  type Address = `0x${string}`;
  type SwapQuote = Awaited<ReturnType<typeof getSwapQuote>>;

  // ── Config ────────────────────────────────────────────────────────────────
  const execute = process.env.ARB_EXECUTE === '1';
  const tradeSize = envNum('ARB_TRADE_SIZE', 50);
  const minTradeSize = envNum('ARB_MIN_TRADE_SIZE', 5);
  const minEdgeBps = Math.max(1, envNum('ARB_MIN_EDGE_BPS', 5)); // hard floor: never trade at <= 0 edge
  const slippageBps = envNum('ARB_SLIPPAGE_BPS', 10);
  const pollMs = envNum('ARB_POLL_MS', 20_000);
  const gasUsdPerLeg = envNum('ARB_GAS_USD_PER_LEG', 0.01);
  const feeAsCost = process.env.ARB_COUNT_PLATFORM_FEE_AS_COST !== 'false';
  const rpcUrl = process.env.ARB_RPC_URL || 'https://forno.celo.org';
  const privateKey = process.env.ARB_BOT_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (execute && !privateKey) {
    console.error('ARB_EXECUTE=1 requires ARB_BOT_PRIVATE_KEY (or PRIVATE_KEY) in the env.');
    process.exit(1);
  }

  const account = privateKey
    ? privateKeyToAccount((privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Address)
    : null;
  const botAddress = (account?.address ?? '0x1111111111111111111111111111111111111111') as Address;

  const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });
  const walletClient = account
    ? createWalletClient({ account, chain: celo, transport: http(rpcUrl) })
    : null;

  const tokenAddr = (s: TokenSymbol) =>
    SWAP_TOKENS.find((t) => t.symbol === s)!.address as Address;

  const ERC20_BALANCE_ABI = [
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'owner', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ] as const;

  async function balanceOf(token: TokenSymbol): Promise<bigint> {
    return publicClient.readContract({
      address: tokenAddr(token),
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [botAddress],
    });
  }

  // ── Quoting ───────────────────────────────────────────────────────────────
  async function quoteVenue(
    venue: Venue,
    from: TokenSymbol,
    to: TokenSymbol,
    amount: string,
  ): Promise<SwapQuote | null> {
    try {
      const quote =
        venue.kind === 'mento'
          ? await getSwapQuote(from, to, amount, slippageBps)
          : await getUniswapQuote(from, to, amount, slippageBps, venue.feeTier);
      if (!quote.isTradable) return null;
      return quote;
    } catch {
      return null; // empty pool, circuit breaker, RPC hiccup — just skip the venue
    }
  }

  interface Opportunity {
    startToken: TokenSymbol;
    otherToken: TokenSymbol;
    amountIn: bigint;
    amountInStr: string;
    leg1: { venue: Venue; quote: SwapQuote };
    leg2: { venue: Venue; quote: SwapQuote };
    /** what the wallet ends with minus what it started with (start-token units) */
    physicalPnl: bigint;
    /** platform fees paid to our own FeeCollector across both legs (≈ start-token units) */
    recycledFees: bigint;
    /** pnl used for the go/no-go decision, per fee accounting mode, minus gas */
    decisionPnl: bigint;
    requiredPnl: bigint;
  }

  async function findOpportunity(
    startToken: TokenSymbol,
    amountIn: bigint,
  ): Promise<Opportunity | null> {
    const otherToken: TokenSymbol = startToken === 'USDC' ? 'USDT' : 'USDC';
    const amountInStr = formatUnits(amountIn, TOKEN_DECIMALS);

    const leg1Quotes = (
      await Promise.all(VENUES.map(async (v) => ({ venue: v, quote: await quoteVenue(v, startToken, otherToken, amountInStr) })))
    ).filter((q): q is { venue: Venue; quote: SwapQuote } => q.quote !== null);
    if (leg1Quotes.length === 0) return null;

    const leg1 = leg1Quotes.reduce((a, b) =>
      parseUnits(b.quote.amountOutNet, TOKEN_DECIMALS) > parseUnits(a.quote.amountOutNet, TOKEN_DECIMALS) ? b : a,
    );
    const leg1Net = parseUnits(leg1.quote.amountOutNet, TOKEN_DECIMALS);
    const leg1Gross = parseUnits(leg1.quote.amountOutGross, TOKEN_DECIMALS);

    // Second leg on a DIFFERENT venue — same-venue round trips are guaranteed
    // fee burn and would look like wash trading.
    const leg2Venues = VENUES.filter((v) => v.id !== leg1.venue.id);
    const leg2Quotes = (
      await Promise.all(
        leg2Venues.map(async (v) => ({
          venue: v,
          quote: await quoteVenue(v, otherToken, startToken, formatUnits(leg1Net, TOKEN_DECIMALS)),
        })),
      )
    ).filter((q): q is { venue: Venue; quote: SwapQuote } => q.quote !== null);
    if (leg2Quotes.length === 0) return null;

    const leg2 = leg2Quotes.reduce((a, b) =>
      parseUnits(b.quote.amountOutNet, TOKEN_DECIMALS) > parseUnits(a.quote.amountOutNet, TOKEN_DECIMALS) ? b : a,
    );
    const leg2Net = parseUnits(leg2.quote.amountOutNet, TOKEN_DECIMALS);
    const leg2Gross = parseUnits(leg2.quote.amountOutGross, TOKEN_DECIMALS);

    const physicalPnl = leg2Net - amountIn;
    // Fees are in output-token units per leg; both tokens ≈ $1 so summing is fine.
    const recycledFees = leg1Gross - leg1Net + (leg2Gross - leg2Net);
    const gasCost = parseUnits((gasUsdPerLeg * 2).toFixed(TOKEN_DECIMALS), TOKEN_DECIMALS);
    const decisionPnl = (feeAsCost ? physicalPnl : physicalPnl + recycledFees) - gasCost;
    const requiredPnl = (amountIn * BigInt(minEdgeBps)) / 10_000n;

    return {
      startToken,
      otherToken,
      amountIn,
      amountInStr,
      leg1,
      leg2,
      physicalPnl,
      recycledFees,
      decisionPnl,
      requiredPnl,
    };
  }

  // ── Execution ─────────────────────────────────────────────────────────────
  async function sendAndWait(tx: { to: Address; data: `0x${string}`; value?: bigint }) {
    const hash = await walletClient!.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value ?? 0n,
      account: account!,
      chain: celo,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`tx reverted: ${hash}`);
    return hash;
  }

  async function executeLeg(
    venue: Venue,
    from: TokenSymbol,
    to: TokenSymbol,
    amountStr: string,
  ): Promise<{ received: bigint; hash: string }> {
    const built =
      venue.kind === 'mento'
        ? await buildSwapTransaction(from, to, amountStr, botAddress, slippageBps)
        : await buildUniswapSwapTransaction(from, to, amountStr, botAddress, slippageBps, venue.feeTier);

    if (built.approval) {
      await sendAndWait({ to: built.approval.to, data: built.approval.data });
    }

    const before = await balanceOf(to);
    const hash = await sendAndWait({
      to: built.swap.params.to,
      data: built.swap.params.data,
      value: built.swap.params.value ? BigInt(built.swap.params.value) : 0n,
    });
    const after = await balanceOf(to);
    return { received: after - before, hash };
  }

  function recordTrade(entry: Record<string, unknown>) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(TRADE_LOG, JSON.stringify(entry) + '\n');
  }

  let totalTrades = 0;
  let totalPhysicalPnl = 0n;
  let totalRecycledFees = 0n;
  let totalVolume = 0n;

  async function executeOpportunity(opp: Opportunity) {
    log(
      `EXECUTING ${opp.startToken}→${opp.otherToken}→${opp.startToken} ` +
        `${opp.amountInStr} via ${opp.leg1.venue.id} → ${opp.leg2.venue.id} ` +
        `(expected pnl ${formatUnits(opp.physicalPnl, TOKEN_DECIMALS)} ${opp.startToken})`,
    );

    const leg1 = await executeLeg(opp.leg1.venue, opp.startToken, opp.otherToken, opp.amountInStr);
    log(`  leg1 ${opp.leg1.venue.id}: received ${formatUnits(leg1.received, TOKEN_DECIMALS)} ${opp.otherToken} (${leg1.hash})`);

    // Leg 2 converts actual received amount back. Retry a few times — a failed
    // leg 2 strands inventory in the other stablecoin (low risk, but fix it now).
    let leg2: { received: bigint; hash: string } | null = null;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3 && !leg2; attempt++) {
      try {
        leg2 = await executeLeg(
          opp.leg2.venue,
          opp.otherToken,
          opp.startToken,
          formatUnits(leg1.received, TOKEN_DECIMALS),
        );
      } catch (err) {
        lastErr = err;
        log(`  leg2 attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    if (!leg2) {
      log(`  leg2 FAILED after retries — inventory now in ${opp.otherToken}; next cycles will trade from there.`);
      recordTrade({
        ts: new Date().toISOString(),
        status: 'leg2-failed',
        startToken: opp.startToken,
        amountIn: opp.amountInStr,
        leg1: { venue: opp.leg1.venue.id, hash: leg1.hash, received: formatUnits(leg1.received, TOKEN_DECIMALS) },
        error: lastErr instanceof Error ? lastErr.message : String(lastErr),
      });
      return;
    }

    const realizedPnl = leg2.received - opp.amountIn;
    totalTrades += 1;
    totalPhysicalPnl += realizedPnl;
    totalRecycledFees += opp.recycledFees;
    totalVolume += opp.amountIn * 2n;

    log(
      `  leg2 ${opp.leg2.venue.id}: received ${formatUnits(leg2.received, TOKEN_DECIMALS)} ${opp.startToken} (${leg2.hash})`,
    );
    log(
      `  ✅ round trip done: realized ${formatUnits(realizedPnl, TOKEN_DECIMALS)} ${opp.startToken}, ` +
        `+${formatUnits(opp.recycledFees, TOKEN_DECIMALS)} to FeeCollector | ` +
        `lifetime: ${totalTrades} trades, pnl ${formatUnits(totalPhysicalPnl, TOKEN_DECIMALS)}, ` +
        `fees ${formatUnits(totalRecycledFees, TOKEN_DECIMALS)}, volume ${formatUnits(totalVolume, TOKEN_DECIMALS)}`,
    );

    recordTrade({
      ts: new Date().toISOString(),
      status: 'completed',
      startToken: opp.startToken,
      amountIn: opp.amountInStr,
      leg1: { venue: opp.leg1.venue.id, hash: leg1.hash, received: formatUnits(leg1.received, TOKEN_DECIMALS) },
      leg2: { venue: opp.leg2.venue.id, hash: leg2.hash, received: formatUnits(leg2.received, TOKEN_DECIMALS) },
      realizedPnl: formatUnits(realizedPnl, TOKEN_DECIMALS),
      recycledFees: formatUnits(opp.recycledFees, TOKEN_DECIMALS),
    });
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  async function cycle() {
    const balances: Record<TokenSymbol, bigint> = account
      ? { USDC: await balanceOf('USDC'), USDT: await balanceOf('USDT') }
      : {
          // dry-run without a key: pretend we hold the configured size in both
          USDC: parseUnits(String(tradeSize), TOKEN_DECIMALS),
          USDT: parseUnits(String(tradeSize), TOKEN_DECIMALS),
        };

    // Try the richer inventory side first; round trips return to the start token.
    const order: TokenSymbol[] = balances.USDC >= balances.USDT ? ['USDC', 'USDT'] : ['USDT', 'USDC'];

    for (const startToken of order) {
      const target = parseUnits(String(tradeSize), TOKEN_DECIMALS);
      const size = balances[startToken] < target ? balances[startToken] : target;
      if (size < parseUnits(String(minTradeSize), TOKEN_DECIMALS)) continue;

      const opp = await findOpportunity(startToken, size);
      if (!opp) continue;

      const edgeBps = Number((opp.decisionPnl * 10_000n) / opp.amountIn);
      const summary =
        `${opp.startToken}→${opp.otherToken}→${opp.startToken} best ${opp.leg1.venue.id}→${opp.leg2.venue.id}: ` +
        `physical ${formatUnits(opp.physicalPnl, TOKEN_DECIMALS)}, recycled fees ${formatUnits(opp.recycledFees, TOKEN_DECIMALS)}, ` +
        `edge ${edgeBps}bps (need ${minEdgeBps}bps)`;

      if (opp.decisionPnl > 0n && opp.decisionPnl >= opp.requiredPnl) {
        if (!execute) {
          log(`${summary} — WOULD EXECUTE (dry-run; set ARB_EXECUTE=1 to trade)`);
        } else {
          await executeOpportunity(opp);
        }
        return; // one round trip per cycle
      }
      log(`${summary} — skip`);
      return; // logging one direction per cycle is enough; the other is its mirror
    }
    log('no tradable inventory above ARB_MIN_TRADE_SIZE — idle');
  }

  // ── Startup ───────────────────────────────────────────────────────────────
  console.log('─'.repeat(72));
  console.log('Jahpay arb bot — Mento vs Uniswap V3 USDC/USDT (Celo mainnet)');
  console.log(`mode:            ${execute ? 'LIVE — sending transactions' : 'dry-run (ARB_EXECUTE=1 to go live)'}`);
  console.log(`wallet:          ${account ? botAddress : '(no key — quoting only)'}`);
  console.log(`router:          ${JAHPAY_ROUTER_ADDRESS}`);
  console.log(`trade size:      $${tradeSize} | min edge: ${minEdgeBps}bps | slippage: ${slippageBps}bps | poll: ${pollMs}ms`);
  console.log(`platform fee:    ${PLATFORM_FEE_BPS}bps/leg counted as ${feeAsCost ? 'COST (conservative)' : 'recycled (goes to your FeeCollector)'}`);
  console.log(`trade log:       ${TRADE_LOG}`);
  console.log('─'.repeat(72));

  if (account) {
    const [usdc, usdt, nativeCelo] = await Promise.all([
      balanceOf('USDC'),
      balanceOf('USDT'),
      publicClient.getBalance({ address: botAddress }),
    ]);
    console.log(
      `balances: ${formatUnits(usdc, 6)} USDC | ${formatUnits(usdt, 6)} USDT | ${formatUnits(nativeCelo, 18)} CELO`,
    );
    if (execute && nativeCelo < 10n ** 17n) {
      console.warn('⚠ less than 0.1 CELO for gas — top up before running for long.');
    }
    if (execute && usdc + usdt === 0n) {
      console.warn('⚠ no USDC/USDT inventory — the bot has nothing to trade with.');
    }
  }

  let stopped = false;
  process.on('SIGINT', () => {
    stopped = true;
    log('SIGINT — finishing current cycle then exiting.');
  });

  while (!stopped) {
    try {
      await cycle();
    } catch (err) {
      log(`cycle error: ${err instanceof Error ? err.message : err}`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
