import { NextResponse } from 'next/server';
import { AGENT_CONFIG } from '@/lib/minipay/constants';
import { getX402PayTo } from '@/lib/api/x402';

export const runtime = 'edge';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://jahpay.xyz';

/**
 * ERC-8004 Agent Manifest
 * Served at /api/agent/manifest and referenced as agentURI in the on-chain registry.
 * Compatible with the ERC-8004 Agent Trust Protocol specification.
 */
export async function GET() {
  const manifest = {
    type: 'Agent',
    name: AGENT_CONFIG.name,
    description: AGENT_CONFIG.description,
    version: '1.0.0',
    image: `${BASE_URL}/agent-avatar.png`,
    endpoints: [
      {
        type: 'a2a',
        url: `${BASE_URL}/.well-known/agent.json`,
      },
      {
        type: 'x402',
        url: `${BASE_URL}/api/agent/catalog`,
        description: 'Catalog of pay-per-request x402 services (USDC on Celo)',
      },
      {
        type: 'wallet',
        address: getX402PayTo() || '0x0000000000000000000000000000000000000000',
        chainId: AGENT_CONFIG.chainId,
      },
    ],
    capabilities: [
      'swap-optimization',
      'slippage-recommendation',
      'rate-monitoring',
      'circuit-breaker-detection',
    ],
    supportedPairs: [
      { from: 'USDC', to: 'USDT', chain: 'celo' },
      { from: 'USDT', to: 'USDC', chain: 'celo' },
    ],
    supportedTrust: ['reputation', 'validation'],
    protocol: {
      dex: 'Mento Protocol v3',
      chain: 'Celo Mainnet',
      chainId: 42220,
    },
    links: {
      app: BASE_URL,
      docs: 'https://github.com/strngecloud/jaahpay',
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
