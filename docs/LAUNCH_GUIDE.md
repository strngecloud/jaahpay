# Jahpay Launch Guide — Agent, x402 & ArbBot

Step-by-step guide to go from the current state to a live agent earning x402
revenue and an arb bot trading on Celo mainnet, plus the hackathon submission.

Last updated: 2026-07-12. Hackathon (`agentic-payments-defai` on
celobuilders.xyz) **submission deadline: 2026-07-20 09:00 UTC**.

---

## 1. Where you are today

| Item | Status |
|---|---|
| ERC-8004 agent registered on Celo mainnet | ✅ Agent ID **9105** (`NEXT_PUBLIC_AGENT_ID`) |
| Celo Builders hackathon registration | ✅ Attribution tag `celo_cc9e2c49ca49` baked into swap builders |
| Contracts deployed (Router, FeeCollector, RampAggregator) | ✅ Mainnet addresses in `.env`s |
| x402 paywall middleware + `/.well-known` discovery | ✅ Code done, on `fix/spend-critical-audit` (partly uncommitted) |
| `/playground` (real x402 payments via thirdweb) | ⚠️ Built, **blocked on `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`** + a funded-wallet test |
| ArbBot (`pnpm bot:arb`) + fee sweep (`pnpm bot:sweep`) | ⚠️ Dry-run verified, **blocked on funded bot wallet + FeeCollector fix** |
| FeeCollector `0x5c04…C46` | ⚠️ 2.36 CELO withdrawable; ERC20 fees accrue but are stuck (accounting bug) |

---

## 2. Registrations / sign-ups you still need

### Required

| Service | What you get | Where | Blocks |
|---|---|---|---|
| **thirdweb** | `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `THIRDWEB_SECRET_KEY` | [thirdweb.com/dashboard](https://thirdweb.com/dashboard) → Settings → API Keys (free) | `/playground`, premium x402 analysis panel |
| **Reown (WalletConnect)** | `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | [dashboard.reown.com](https://dashboard.reown.com) (free) | Wallet connect for non-MiniPay browsers |
| **X/Twitter post** | Public post announcing your submission → its URL is the **required** `socialLink` submission field | x.com | Hackathon publish |

### Not needed (already permissionless / done)

- **x402 facilitator** — `https://api.x402.celo.org` needs no API key or registration; verify/settle are open endpoints.
- **ERC-8004** — already registered (ID 9105). Re-run `pnpm deploy:agent` only if you want a fresh identity.
- **Celo Builders** — already registered (you have an attribution tag).

### Optional

| Service | Env vars | Where | Why |
|---|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | supabase.com | Transaction history |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN` | sentry.io | Error tracking |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY` | posthog.com | Analytics |
| Aigora | agent profile at aigora.org (register on **Celo Sepolia**, chainId 11142220) | aigora.org | Extra hackathon track: "Best Feedback for Aigora" ($50 prizes) |
| Wema / Providus / Paystack | see `apps/server/.env` | respective developer portals | Only for the fiat spend backend, not needed for agent/x402/ArbBot |

---

## 3. Launch order (follow top to bottom)

### Step 1 — Fill the two missing keys (10 min)

1. thirdweb dashboard → create project → copy Client ID + Secret into
   `apps/web/.env` (`NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `THIRDWEB_SECRET_KEY`).
2. Reown dashboard → create project → copy the Project ID into
   `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`.

### Step 2 — Create and fund a dedicated bot wallet (30 min)

Do **not** reuse the deployer key (`PRIVATE_KEY`) for live trading — it is
already the contract owner and the agent deployer. Generate a fresh key
(e.g. `cast wallet new`) and fund it on Celo mainnet:

- **USDC + USDT inventory** — ~$50–100 total to start (bot defaults to $50
  round trips, `ARB_TRADE_SIZE`). The deployer wallet only holds ~5 USDC.
- **CELO for gas** — 1–2 CELO is plenty (legs cost ~$0.01).
- Also send a few USDC to whatever wallet you'll use in `/playground`
  (payments are $0.001–$0.05 each).

Set it in `apps/web/.env`: `ARB_BOT_PRIVATE_KEY=0x…`

### Step 3 — Fix the FeeCollector (owner tx, 5 min)

The router `safeTransfer`s ERC20 fees straight to FeeCollector, bypassing its
`collectedFees` accounting, so `withdrawFees` reverts for ERC20s. Recommended
fix: point the router's fee sink at your bot wallet instead:

```
router.setFeeCollector(<bot wallet address>)   # owner = PRIVATE_KEY wallet
```

Then recover what's already there:

```bash
cd apps/web
pnpm bot:sweep                # dry-run report
EXECUTE=1 pnpm bot:sweep      # withdraws the ~2.36 CELO (SWEEP_TO optional)
```

### Step 4 — Run the ArbBot (ongoing)

```bash
cd apps/web
pnpm bot:arb                  # dry-run: quotes + decisions, no txs
ARB_EXECUTE=1 pnpm bot:arb    # live
```

Only after Step 3 is done, flip `ARB_COUNT_PLATFORM_FEE_AS_COST=false` in
`apps/web/.env` — the router's 0.3% fee then counts as recycled (it lands in
a wallet you control), which is what actually lets the bot find trades.
Every trade carries your attribution tag automatically, so live trades feed
the **Most Revenue Generated** leaderboard.

### Step 5 — Test x402 end-to-end (30 min)

1. `pnpm dev`, open `http://localhost:3000/playground`.
2. Connect the funded wallet, call a paid endpoint (e.g. agent chat, $0.005).
3. Confirm you get a JSON result + a Celoscan receipt from the
   `X-PAYMENT-RESPONSE` header, and that USDC lands at
   `NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS`.

External agents can also pay directly:
`curl https://jahpay.xyz/api/agent/recommendation` → 402 with payment
requirements → retry with `X-PAYMENT` header. Discovery lives at
`/.well-known/x402` and `/.well-known/agent.json`.

### Step 6 — Commit and deploy to jahpay.xyz

The playground + x402 work is uncommitted on `fix/spend-critical-audit`.
Commit, merge, and deploy — the `/.well-known` endpoints and paid APIs only
count for the leaderboard once they're live in production.

> Note: `scripts/deploy-agent.ts` registers the agent URI as
> `https://jahpay.vercel.app/api/agent/manifest` while the manifest defaults
> to `https://jahpay.xyz`. Make sure `NEXT_PUBLIC_APP_URL=https://jahpay.xyz`
> is set in production, and consider updating the on-chain agent URI to match.

### Step 7 — Publish the hackathon submission (before 2026-07-20 09:00 UTC)

Required submission fields for `agentic-payments-defai`:

| Field | Value |
|---|---|
| `socialLink` | URL of your **public X/Twitter post** about the submission (make the post first) |
| `erc8004Url` | `https://8004scan.io/agents/celo/9105` |
| `agentWalletAddress` | The Celo mainnet payTo address (your FeeCollector / bot wallet — the one receiving x402 payments) |
| `celoNetwork` | `celo-mainnet` (only allowed value) |
| GitHub repo | Must be **public** at publish time |
| `appDomain` (optional) | `jahpay.xyz` |
| Aigora fields (optional) | Profile URL + feedback-issue URL, only for the Aigora track |

Tracks to target: **most-x402-payments**, **most-revenue-generated**
(volume tracked live on the [Dune leaderboard](https://dune.com/celo/agentic-payments-defai-hackathon)).
Ask me to walk you through connect → draft → publish via celobuilders.xyz
when you're ready; publishing needs your explicit approval.

---

## 4. Env file map (what lives where)

| File | Purpose | Must fill before launch |
|---|---|---|
| `apps/web/.env` | Next.js app, agent, x402, ArbBot, sweep | `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `THIRDWEB_SECRET_KEY`, `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`, `ARB_BOT_PRIVATE_KEY` |
| `apps/server/.env` | NestJS spend backend (fiat rails) | `ADMIN_API_KEY`, `PROCESSOR_WALLET_PRIVATE_KEY`, bank keys — only if you run the spend flow |
| `apps/contracts/.env` | Deploy + `write-contracts.js` admin script | `PAUSER` (backend signer) only when running that script |

All three `.env`s are gitignored (verified). `.env.example` files are synced
with every field the code reads.

## 5. Security notes

- **One key is doing three jobs**: `PRIVATE_KEY` (contracts owner) ==
  `AGENT_DEPLOYER_PRIVATE_KEY` == web `.env` `PRIVATE_KEY`. Fine for a
  hackathon, but keep the arb bot on its own key (Step 2) so a bot leak
  can't drain owner privileges, and rotate after the hackathon.
- `PROCESSOR_WALLET_PRIVATE_KEY` in the server `.env` is a zero placeholder —
  the spend backend can't complete/refund spends until it's a real authorized
  key. Not a blocker for agent/x402/ArbBot.
- Never put any of these keys in `NEXT_PUBLIC_*` vars or commit them; the
  hackathon submission must not contain secrets either.
