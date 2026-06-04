# Swap Providers on Celo

Jahpay uses **Mento Protocol v3** as the primary execution layer for USDC ↔ USDT. This document covers Celo ecosystem alternatives and how Jahpay integrates them.

Reference: [Exchanges on Celo](https://docs.celo.org/home/exchanges)

## Primary: Mento Protocol (integrated)

| Feature | Details |
|---------|---------|
| SDK | `@mento-protocol/mento-sdk` v3 |
| Pairs | USDC ↔ USDT (direct or via USDm) |
| Pricing | Oracle-based, low slippage for stablecoins |
| API in Jahpay | `getSwapQuote`, `buildSwapTransaction`, `/api/swap/rates` |

Mento is the **native** stablecoin infrastructure on Celo. There is no separate REST “swap API” from Celo Foundation — swaps are on-chain via the Mento SDK.

## Alternative DEXes (credibility / future routing)

Per [Celo docs](https://docs.celo.org/home/exchanges), these DEXes operate on Celo:

| Provider | URL | Best for |
|----------|-----|----------|
| **Ubeswap** | https://app.ubeswap.org | CELO, cUSD, broad Celo-native pairs |
| **Uniswap** | https://app.uniswap.org | CELO, USDC, USDT — Uniswap v3 on Celo |
| **Velodrome** | https://velodrome.finance | Additional liquidity |
| **Mento** | https://app.mento.org | Stablecoin swaps (Jahpay default) |

### CELO ↔ USDC / USDT

- **Mento**: CELO↔stable pairs when tradable (checked via `isMentoPairTradable` in `/api/swap/rates`)
- **Ubeswap / Uniswap**: Use each DEX’s router contracts or SDK for CELO routes

Jahpay exposes CELO reference rates via Mento in `/api/swap/rates` when the pair is tradable. Full CELO swap UI can be added by integrating Ubeswap/Uniswap router ABIs.

## Jahpay API Endpoints

```bash
# Live Mento rates (USDC/USDT + CELO reference)
GET /api/swap/rates?chainId=42220

# Mento quote proxy (existing)
GET /api/providers/mento-quotes?from=USDC&to=USDT&amount=100

# AI agent with live data
POST /api/agent/chat
POST /api/agent/recommendation
```

## Why not a single “Celo swap API”?

Celo does not provide one centralized swap API. Swaps are executed through:

1. **DEX smart contracts** (Mento, Ubeswap, Uniswap routers)
2. **SDKs** (Mento SDK, viem, wagmi)
3. **Aggregators** (optional: 0x, 1inch if deployed on Celo)

Jahpay’s approach:

- **Execute** via Mento (production-tested for USDC/USDT)
- **Compare** via `/api/swap/rates` and agent chat (mentions Ubeswap/Uniswap)
- **Extend** by adding router integrations for CELO paths

## Production checklist

- [ ] `NEXT_PUBLIC_CHAIN_ID` matches deployment network
- [ ] WalletConnect project ID set
- [ ] Mento quotes succeed on target chain (mainnet or Sepolia)
- [ ] Fee collector address configured (for x402 premium)
- [ ] Supabase optional for cross-device transaction history
