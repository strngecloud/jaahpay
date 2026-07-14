# Autonomous Arb Bot (Mento ↔ Uniswap V3)

A 24/7 worker that watches the USDC/USDT price on both venues Jahpay already
integrates — Mento (oracle-priced) and Uniswap V3 (tiers 100/500) — and
executes a two-leg round trip **through `JahpaySwapRouter`** whenever the
cross-venue spread beats fees + gas. Every transaction:

- carries the Celo Builders attribution tag (`celo_cc9e2c49ca49`) → counts on
  the hackathon leaderboard
- pays the 0.3% platform fee into your own FeeCollector → "Most Revenue
  Generated" evidence

**It only trades real spreads.** The edge threshold is clamped ≥ 1 bps and the
second leg must be on a different venue, so it cannot be configured into
ping-ponging money at a loss to inflate counts — organizers can see wash
patterns on Dune and that gets projects disqualified, not paid.

## Quick start

```bash
# 1. Dry run — quotes both venues, logs decisions, sends nothing
cd apps/web
pnpm bot:arb

# 2. Fund a wallet: USDC and/or USDT inventory + ~0.5 CELO for gas,
#    put its key in apps/web/.env.local:
#    ARB_BOT_PRIVATE_KEY=0x...

# 3. Go live
ARB_EXECUTE=1 pnpm bot:arb

# Keep it running (pick one):
nohup env ARB_EXECUTE=1 pnpm bot:arb > arb.log 2>&1 &
# or: pm2 start "pnpm bot:arb" --name jahpay-arb --env ARB_EXECUTE=1
```

Executed trades are appended to `apps/web/.arb-bot/trades.jsonl` (gitignored)
— handy as revenue evidence for the submission.

## Configuration (env)

| Var | Default | Meaning |
| --- | --- | --- |
| `ARB_BOT_PRIVATE_KEY` | falls back to `PRIVATE_KEY` | funded trading wallet |
| `ARB_EXECUTE` | unset (dry-run) | `1` to send transactions |
| `ARB_TRADE_SIZE` | `50` | USD per round trip (capped by wallet balance) |
| `ARB_MIN_TRADE_SIZE` | `5` | idle below this inventory |
| `ARB_MIN_EDGE_BPS` | `5` | required net edge, clamped ≥ 1 |
| `ARB_SLIPPAGE_BPS` | `10` | per-leg slippage tolerance |
| `ARB_POLL_MS` | `20000` | cycle interval |
| `ARB_GAS_USD_PER_LEG` | `0.01` | assumed gas cost per leg |
| `ARB_COUNT_PLATFORM_FEE_AS_COST` | `true` | see below |
| `ARB_RPC_URL` | forno | RPC endpoint |

## The platform-fee accounting decision (read this)

Each router leg skims 0.3% to the FeeCollector. That's 0.6% per round trip —
stablecoin spreads almost never exceed that, so with the default
(`ARB_COUNT_PLATFORM_FEE_AS_COST=true`, conservative) the bot will rarely fire.

Since the FeeCollector is **yours**, that fee isn't really a cost — it's your
revenue. Set `ARB_COUNT_PLATFORM_FEE_AS_COST=false` and the bot treats it as
recycled, trading whenever the spread beats venue fees + gas. That's the mode
that actually generates volume, **but only flip it after fixing the issue
below**, otherwise you're paying fees into a contract you can't withdraw from.

## ⚠ Deployed FeeCollector can't release ERC20 fees

`JahpaySwapRouter` sends ERC20 fees with a plain `safeTransfer`, which never
updates the `collectedFees` mapping that `FeeCollector.withdrawFees()` checks
— so `withdrawFees` reverts and **USDC/USDT fees are stuck in the contract**
(verified on mainnet: balances present, `collectedFees` = 0; only dust so far).

Fix options, easiest first:

1. **Point fees at a wallet you control** (one transaction, recommended):
   ```bash
   cast send 0x8d5b244f9e16df261b1fb575c498028cc3211d3a \
     "setFeeCollector(address)" <YOUR_WALLET_OR_BOT_WALLET> \
     --rpc-url https://forno.celo.org --private-key $PRIVATE_KEY
   ```
   Pointing it at the **bot wallet** auto-compounds fees into trading
   inventory — every fee becomes future tagged volume.
2. Redeploy a FeeCollector whose withdraw uses `balanceOf` instead of the
   `collectedFees` accounting, then `setFeeCollector` to it.

## Fee sweep job

```bash
pnpm bot:sweep             # report FeeCollector balances / stuck amounts
EXECUTE=1 pnpm bot:sweep   # withdraw whatever withdrawFees() allows (owner key)
```

If you apply fix #1 above, sweeping becomes unnecessary (fees land in a wallet
directly); the bot's normal rebalancing converts them — more tagged volume.
