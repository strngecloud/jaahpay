import { NextResponse } from 'next/server';
import { AGENT_CONFIG, ERC8004_CONTRACTS } from '@/lib/minipay/constants';

export const runtime = 'edge';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://jahpay.xyz';

/**
 * A2A Agent Card served at /.well-known/agent.json — the standard discovery
 * location referenced by the ERC-8004 manifest. Lets other agents find
 * Jahpay's skills and pay-per-request x402 services.
 */
export async function GET() {
  const card = {
    name: AGENT_CONFIG.name,
    description: AGENT_CONFIG.description,
    url: `${BASE_URL}/api/agent/chat`,
    version: '1.0.0',
    // Self-declared Aigora catalog discovery flag
    onAigora: true,
    provider: {
      organization: 'Jahpay',
      url: BASE_URL,
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'mento-quote',
        name: 'Oracle-priced swap quote',
        description:
          'Live Mento Protocol quote for USDC/USDT/CELO pairs on Celo — no AMM slippage. x402-paid: $0.001 per request.',
        tags: ['celo', 'mento', 'stablecoin', 'quote', 'x402'],
        examples: ['Quote 500 USDC to USDT'],
      },
      {
        id: 'market-rates',
        name: 'Market rates snapshot',
        description:
          'Full live market snapshot: rates, pair tradability, circuit-breaker status, volatility index. x402-paid: $0.001 per request.',
        tags: ['celo', 'rates', 'market-data', 'x402'],
        examples: ['Current USDC/USDT rate and tradability'],
      },
      {
        id: 'swap-recommendation',
        name: 'AI swap recommendation',
        description:
          'Optimal slippage, timing, and route recommendation for a planned swap. x402-paid: $0.002 per request.',
        tags: ['celo', 'ai', 'slippage', 'recommendation', 'x402'],
        examples: ['Best slippage for swapping 1000 USDC to USDT'],
      },
      {
        id: 'agent-chat',
        name: 'Swap agent chat',
        description:
          'Conversational access to the Jahpay swap agent with live Mento market context. x402-paid: $0.005 per message.',
        tags: ['celo', 'chat', 'agent', 'x402'],
        examples: ['Should I swap 500 USDC to USDT now?'],
      },
      {
        id: 'premium-analysis',
        name: 'Premium market analysis',
        description:
          'Deep market analysis: pool health, sentiment, macro trends, confidence score. x402-paid: $0.05 per request.',
        tags: ['celo', 'analysis', 'premium', 'x402'],
        examples: ['Full USDC/USDT market analysis'],
      },
    ],
    // ERC-8004 identity on Celo mainnet
    registrations: [
      {
        agentId: Number(AGENT_CONFIG.agentId) || 9105,
        agentRegistry: `eip155:42220:${ERC8004_CONTRACTS.identityRegistry}`,
      },
    ],
    trustModels: ['reputation'],
    // Machine-readable menu of paid endpoints (x402, USDC on Celo)
    x402Catalog: `${BASE_URL}/api/agent/catalog`,
  };

  return NextResponse.json(card, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
