/**
 * USDC ↔ USDT Swap library powered by Mento Protocol SDK v3
 * Handles quotes, transaction building, and fee deduction.
 */

import { Mento, ChainId, deadlineFromMinutes } from '@mento-protocol/mento-sdk';
import { parseUnits, formatUnits, encodeFunctionData, createPublicClient, http, type Address } from 'viem';
import { celo } from 'viem/chains';
import { toDataSuffix } from '@celo/attribution-tags';
import { SWAP_TOKENS, SUPPORTED_TOKENS, PLATFORM_FEE_BPS, SWAP_CONFIG, JAHPAY_ROUTER_ADDRESS, CELO_BUILDERS_ATTRIBUTION_TAG } from '../minipay/constants';
import { getUniswapQuote, buildUniswapSwapTransaction } from './uniswap-swap';

const JAHPAY_ROUTER_ABI = [
  {
    type: 'function',
    name: 'swap',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'tokenOut', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    stateMutability: 'payable',
    outputs: [],
  }
] as const;

const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type SwapTokenSymbol = 'USDC' | 'USDT' | 'CELO';

export interface SwapQuote {
  fromToken: SwapTokenSymbol;
  toToken: SwapTokenSymbol;
  amountIn: string;
  /** Gross amount before fee */
  amountOutGross: string;
  /** Net amount user receives after platform fee */
  amountOutNet: string;
  /** Platform fee in output token */
  platformFee: string;
  platformFeePercent: number;
  /** Exchange rate (net) */
  rate: number;
  /** Is this a direct swap or routed via USDm? */
  route: 'direct' | 'via-usdm' | 'uniswap-v3';
  /** Uniswap V3 pool fee tier used for this quote (uniswap-v3 route only) */
  feeTier?: number;
  /** Slippage tolerance in BPS used for this quote */
  slippageBps: number;
  /** Is the pair currently tradable? */
  isTradable: boolean;
  timestamp: number;
}

export interface SwapTransaction {
  approval: any | null;
  swap: any;
  quote: SwapQuote;
}

// ─── Routing ──────────────────────────────────────────────────────────────────

/** Returns true when at least one side of the pair is CELO (requires Uniswap) */
export function isCeloPair(from: SwapTokenSymbol, to: SwapTokenSymbol): boolean {
  return from === 'CELO' || to === 'CELO';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTokenAddress(symbol: string, chainId: number): string {
  const token = SUPPORTED_TOKENS.find((t) => t.symbol === symbol);
  if (!token) throw new Error(`Token ${symbol} not found`);
  return chainId === 11142220 ? (token as any).addressSepolia || token.address : token.address;
}

function getTokenDecimals(symbol: string): number {
  const token = SUPPORTED_TOKENS.find((t) => t.symbol === symbol);
  if (!token) throw new Error(`Token ${symbol} not found`);
  return token.decimals;
}

async function getMento(chainId: number): Promise<Mento> {
  const mentoChainId = chainId === 11142220 ? ChainId.CELO_SEPOLIA : ChainId.CELO;
  return Mento.create(mentoChainId);
}

/** Compute platform fee and net amount */
function applyFee(grossAmountStr: string, decimals: number): {
  gross: string;
  fee: string;
  net: string;
} {
  const grossBig = BigInt(Math.round(parseFloat(grossAmountStr) * 10 ** decimals));
  const feeBig = (grossBig * BigInt(PLATFORM_FEE_BPS)) / BigInt(10_000);
  const netBig = grossBig - feeBig;
  return {
    gross: formatUnits(grossBig, decimals),
    fee: formatUnits(feeBig, decimals),
    net: formatUnits(netBig, decimals),
  };
}

// ─── Check pair tradability ───────────────────────────────────────────────────

export async function checkPairTradable(
  fromToken: SwapTokenSymbol,
  toToken: SwapTokenSymbol,
  chainId = 42220
): Promise<boolean> {
  try {
    const mento = await getMento(chainId);
    const fromAddr = getTokenAddress(fromToken, chainId);
    const toAddr = getTokenAddress(toToken, chainId);
    return await mento.trading.isPairTradable(fromAddr, toAddr);
  } catch {
    // Fallback: assume tradable if SDK call fails (circuit breaker check)
    return true;
  }
}

// ─── Get Swap Quote ───────────────────────────────────────────────────────────

export async function getSwapQuote(
  fromToken: SwapTokenSymbol,
  toToken: SwapTokenSymbol,
  amountIn: string,
  slippageBps: number = SWAP_CONFIG.DEFAULT_SLIPPAGE_BPS,
  chainId = 42220
): Promise<SwapQuote> {
  if (!amountIn || parseFloat(amountIn) <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  // Route CELO pairs through Uniswap V3
  if (isCeloPair(fromToken, toToken)) {
    return getUniswapQuote(fromToken, toToken, amountIn, slippageBps);
  }

  const mento = await getMento(chainId);
  const fromAddr = getTokenAddress(fromToken, chainId);
  const toAddr = getTokenAddress(toToken, chainId);
  const fromDecimals = getTokenDecimals(fromToken);
  const toDecimals = getTokenDecimals(toToken);

  const amountInParsed = parseUnits(amountIn, fromDecimals);

  // Check tradability (circuit breaker)
  let isTradable = true;
  try {
    isTradable = await mento.trading.isPairTradable(fromAddr, toAddr);
  } catch {
    isTradable = true;
  }

  // Try direct quote first, fall back to routing via USDm
  let amountOutRaw: bigint;
  let route: 'direct' | 'via-usdm' = 'direct';

  try {
    amountOutRaw = await mento.quotes.getAmountOut(fromAddr, toAddr, amountInParsed);
  } catch {
    // Route via USDm
    const usdmToken = SUPPORTED_TOKENS.find((t) => t.symbol === 'USDm')!;
    const usdmAddr = chainId === 11142220 ? usdmToken.addressSepolia : usdmToken.address;
    const midAmount = await mento.quotes.getAmountOut(fromAddr, usdmAddr, amountInParsed);
    amountOutRaw = await mento.quotes.getAmountOut(usdmAddr, toAddr, midAmount);
    route = 'via-usdm';
  }

  const grossStr = formatUnits(amountOutRaw, toDecimals);
  const { gross, fee, net } = applyFee(grossStr, toDecimals);
  const rate = parseFloat(net) / parseFloat(amountIn);

  return {
    fromToken,
    toToken,
    amountIn,
    amountOutGross: gross,
    amountOutNet: net,
    platformFee: fee,
    platformFeePercent: PLATFORM_FEE_BPS / 100,
    rate,
    route,
    slippageBps,
    isTradable,
    timestamp: Date.now(),
  };
}

// ─── Build Swap Transaction ───────────────────────────────────────────────────

export async function buildSwapTransaction(
  fromToken: SwapTokenSymbol,
  toToken: SwapTokenSymbol,
  amountIn: string,
  userAddress: string,
  slippageBps: number = SWAP_CONFIG.DEFAULT_SLIPPAGE_BPS,
  chainId = 42220
): Promise<SwapTransaction> {
  // Route CELO pairs through Uniswap V3
  if (isCeloPair(fromToken, toToken)) {
    return buildUniswapSwapTransaction(fromToken, toToken, amountIn, userAddress, slippageBps);
  }

  const quote = await getSwapQuote(fromToken, toToken, amountIn, slippageBps, chainId);

  if (!quote.isTradable) {
    throw new Error(`${fromToken}↔${toToken} is temporarily paused by Mento circuit breaker`);
  }

  const mento = await getMento(chainId);
  const fromAddr = getTokenAddress(fromToken, chainId);
  const toAddr = getTokenAddress(toToken, chainId);
  const fromDecimals = getTokenDecimals(fromToken);
  const amountInParsed = parseUnits(amountIn, fromDecimals);
  const slippageTolerance = slippageBps / 100; // SDK takes percentage

  // For stablecoin swaps via Mento, we need the router to be the sender
  // so it can deduct fees from the output. However, Mento's SDK generates
  // transactions that expect the token holder to execute the swap.
  // The fix: keep sender as router but use router as recipient to capture output
  // The router contract will approve itself to receive Mento's calls
  const { swap: mentoSwap } = await mento.swap.buildSwapTransaction(
    fromAddr,
    toAddr,
    amountInParsed,
    JAHPAY_ROUTER_ADDRESS as Address, // Mento needs the router (the token owner at execution time) for the internal swap
    JAHPAY_ROUTER_ADDRESS, // But output goes to router so it can deduct fees
    {
      slippageTolerance,
      deadline: deadlineFromMinutes(SWAP_CONFIG.DEADLINE_MINUTES),
    }
  );


  const routerData = encodeFunctionData({
    abi: JAHPAY_ROUTER_ABI,
    functionName: 'swap',
    args: [
      fromAddr as Address,
      amountInParsed,
      toAddr as Address,
      mentoSwap.params.to as Address,
      mentoSwap.params.data as `0x${string}`,
    ],
  });

  // Append the Celo Builders attribution tag (ERC-8021 data suffix) so this
  // transaction is counted toward the hackathon leaderboard.
  const taggedRouterData = (routerData +
    toDataSuffix(CELO_BUILDERS_ATTRIBUTION_TAG).slice(2)) as `0x${string}`;

  // Build approval tx if swapping FROM an ERC-20
  let approval: {
    to: Address;
    data: `0x${string}`;
  } | null = null;

  if (fromToken !== 'CELO') {
    const client = createPublicClient({ chain: celo, transport: http() });
    const currentAllowance = await client.readContract({
      address: fromAddr as Address,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [userAddress as Address, JAHPAY_ROUTER_ADDRESS as Address],
    });

    if (BigInt(currentAllowance.toString()) < amountInParsed) {
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [JAHPAY_ROUTER_ADDRESS as Address, amountInParsed],
      });
      approval = {
        to: fromAddr as Address,
        data: approveData,
      };
    }
  }

  return {
    approval,
    swap: {
      params: {
        to: JAHPAY_ROUTER_ADDRESS as Address,
        data: taggedRouterData,
      },
    },
    quote,
  };
}

// ─── Token utilities ──────────────────────────────────────────────────────────

export function getSwapTokenInfo(symbol: SwapTokenSymbol) {
  return SWAP_TOKENS.find((t) => t.symbol === symbol)!;
}

export function getOppositeToken(symbol: SwapTokenSymbol): SwapTokenSymbol {
  // For CELO, default to USDC
  if (symbol === 'CELO') return 'USDC';
  // For USDC/USDT, toggle between them
  return symbol === 'USDC' ? 'USDT' : 'USDC';
}

export function isValidSwapPair(from: SwapTokenSymbol, to: SwapTokenSymbol): boolean {
  // Can't swap token to itself
  if (from === to) return false;
  // All combinations of CELO, USDC, USDT are valid
  return true;
}

export function formatTokenAmount(amount: string | number, decimals = 6): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
}
