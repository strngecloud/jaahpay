/**
 * Uniswap V3 Swap engine for CELO ↔ USDC/USDT pairs on Celo mainnet.
 * Uses SwapRouter02 (exactInputSingle) and QuoterV2 for on-chain quotes.
 *
 * This module is ONLY used for swaps involving CELO.
 * Stablecoin-only swaps (USDC↔USDT) continue to use Mento via usdc-usdt-swap.ts.
 *
 * CELO-input swaps call SwapRouter02 directly (see buildUniswapSwapTransaction);
 * ERC-20-input swaps are wrapped through JahpaySwapRouter for fee collection.
 */

import {
  createPublicClient,
  http,
  encodeFunctionData,
  formatUnits,
  parseUnits,
  type Address,
} from 'viem';
import { celo } from 'viem/chains';
import { toDataSuffix } from '@celo/attribution-tags';
import {
  SWAP_TOKENS,
  SUPPORTED_TOKENS,
  PLATFORM_FEE_BPS,
  UNISWAP_V3_CONTRACTS,
  UNISWAP_POOL_FEE,
  SWAP_CONFIG,
  JAHPAY_ROUTER_ADDRESS,
  CELO_BUILDERS_ATTRIBUTION_TAG,
} from '../minipay/constants';
import type { SwapQuote, SwapTransaction, SwapTokenSymbol } from './usdc-usdt-swap';

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

// ─── ABIs (minimal) ──────────────────────────────────────────────────────────

const QUOTER_V2_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPublicClient() {
  return createPublicClient({
    chain: celo,
    transport: http(),
  });
}

function getTokenAddress(symbol: string): Address {
  const token = SUPPORTED_TOKENS.find((t) => t.symbol === symbol);
  if (!token) {
    const swapToken = SWAP_TOKENS.find((t) => t.symbol === symbol);
    if (!swapToken) throw new Error(`Token ${symbol} not found`);
    return swapToken.address as Address;
  }
  return token.address as Address;
}

function getTokenDecimals(symbol: string): number {
  const token = SUPPORTED_TOKENS.find((t) => t.symbol === symbol);
  if (token) return token.decimals;
  const swapToken = SWAP_TOKENS.find((t) => t.symbol === symbol);
  if (swapToken) return swapToken.decimals;
  throw new Error(`Token ${symbol} not found`);
}

/** Apply platform fee and compute net amount */
function applyFee(
  grossAmountStr: string,
  decimals: number,
): { gross: string; fee: string; net: string } {
  const grossBig = BigInt(
    Math.round(parseFloat(grossAmountStr) * 10 ** decimals),
  );
  const feeBig = (grossBig * BigInt(PLATFORM_FEE_BPS)) / BigInt(10_000);
  const netBig = grossBig - feeBig;
  return {
    gross: formatUnits(grossBig, decimals),
    fee: formatUnits(feeBig, decimals),
    net: formatUnits(netBig, decimals),
  };
}

// ─── Get Uniswap V3 Quote ────────────────────────────────────────────────────

export async function getUniswapQuote(
  fromToken: SwapTokenSymbol,
  toToken: SwapTokenSymbol,
  amountIn: string,
  slippageBps: number = SWAP_CONFIG.DEFAULT_SLIPPAGE_BPS,
  feeTier: number = UNISWAP_POOL_FEE,
): Promise<SwapQuote> {
  if (!amountIn || parseFloat(amountIn) <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const client = getPublicClient();
  const fromAddr = getTokenAddress(fromToken);
  const toAddr = getTokenAddress(toToken);
  const fromDecimals = getTokenDecimals(fromToken);
  const toDecimals = getTokenDecimals(toToken);
  const amountInParsed = parseUnits(amountIn, fromDecimals);

  // Use QuoterV2 to get the expected output (read-only call via eth_call)
  const result = await client.simulateContract({
    address: UNISWAP_V3_CONTRACTS.QUOTER_V2 as Address,
    abi: QUOTER_V2_ABI,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        tokenIn: fromAddr,
        tokenOut: toAddr,
        amountIn: amountInParsed,
        fee: feeTier,
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  });

  const amountOutRaw = result.result[0];
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
    route: 'uniswap-v3',
    feeTier,
    slippageBps,
    isTradable: true,
    timestamp: Date.now(),
  };
}

// ─── Build Uniswap V3 Swap Transaction ───────────────────────────────────────

export async function buildUniswapSwapTransaction(
  fromToken: SwapTokenSymbol,
  toToken: SwapTokenSymbol,
  amountIn: string,
  userAddress: string,
  slippageBps: number = SWAP_CONFIG.DEFAULT_SLIPPAGE_BPS,
  feeTier: number = UNISWAP_POOL_FEE,
): Promise<SwapTransaction> {
  const quote = await getUniswapQuote(fromToken, toToken, amountIn, slippageBps, feeTier);

  const fromAddr = getTokenAddress(fromToken);
  const toAddr = getTokenAddress(toToken);
  const fromDecimals = getTokenDecimals(fromToken);
  const amountInParsed = parseUnits(amountIn, fromDecimals);

  // Calculate minimum output with slippage tolerance
  const toDecimals = getTokenDecimals(toToken);
  const grossOut = parseUnits(quote.amountOutGross, toDecimals);
  const amountOutMinimum =
    grossOut - (grossOut * BigInt(slippageBps)) / BigInt(10_000);

  // CELO-input swaps go DIRECTLY to Uniswap's SwapRouter02 instead of through
  // JahpaySwapRouter. The router treats CELO input as native and forwards
  // msg.value to the target without setting any allowance, but SwapRouter02
  // pulls tokenIn (CELO is an ERC20 on Celo) via transferFrom — so the value
  // is never used, the pull has no allowance, and the swap always reverts
  // with SwapFailed(). Calling SwapRouter02 directly with a normal ERC-20
  // approve avoids the broken path; the ERC-8021 data suffix below keeps the
  // transaction attributed on the hackathon leaderboard either way.
  const isFromCelo = fromToken === 'CELO';

  const swapData = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: fromAddr,
        tokenOut: toAddr,
        fee: feeTier,
        // Direct swaps pay out to the user; router swaps pay out to the
        // router, which forwards net-of-fee to the user.
        recipient: (isFromCelo ? userAddress : JAHPAY_ROUTER_ADDRESS) as Address,
        amountIn: amountInParsed,
        amountOutMinimum,
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  });

  // Wrap the call for JahpaySwapRouter (ERC-20 input only)
  const outerData = isFromCelo
    ? swapData
    : encodeFunctionData({
        abi: JAHPAY_ROUTER_ABI,
        functionName: 'swap',
        args: [
          fromAddr,
          amountInParsed,
          toToken === 'CELO' ? '0x0000000000000000000000000000000000000000' : toAddr,
          UNISWAP_V3_CONTRACTS.SWAP_ROUTER as Address,
          swapData,
        ],
      });

  // Append the Celo Builders attribution tag (ERC-8021 data suffix) so this
  // transaction is counted toward the hackathon leaderboard.
  const taggedData = (outerData +
    toDataSuffix(CELO_BUILDERS_ATTRIBUTION_TAG).slice(2)) as `0x${string}`;

  // The input token is always pulled via transferFrom (CELO included — it is
  // a regular ERC-20 at 0x471e… on Celo), so the user must approve whichever
  // contract executes the pull: SwapRouter02 for direct CELO swaps, the
  // Jahpay router otherwise.
  const spender = (isFromCelo
    ? UNISWAP_V3_CONTRACTS.SWAP_ROUTER
    : JAHPAY_ROUTER_ADDRESS) as Address;

  let approval: {
    to: Address;
    data: `0x${string}`;
  } | null = null;

  const client = getPublicClient();
  const currentAllowance = await client.readContract({
    address: fromAddr,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress as Address, spender],
  });

  if (BigInt(currentAllowance.toString()) < amountInParsed) {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, amountInParsed],
    });
    approval = {
      to: fromAddr,
      data: approveData,
    };
  }

  return {
    approval,
    swap: {
      params: {
        to: (isFromCelo
          ? UNISWAP_V3_CONTRACTS.SWAP_ROUTER
          : JAHPAY_ROUTER_ADDRESS) as Address,
        data: taggedData,
      },
    },
    quote,
  };
}
