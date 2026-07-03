import { parseUnits, formatUnits } from "viem";

/**
 * Contract helper utilities
 */

export const RAMP_ADDRESSES = {
  mainnet: {
    rampAggregator: process.env.NEXT_PUBLIC_RAMP_AGGREGATOR_ADDRESS || "0x",
    feeCollector: process.env.NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS || "0x",
  },
  alfajores: {
    rampAggregator: process.env.NEXT_PUBLIC_RAMP_AGGREGATOR_ADDRESS || "0x",
    feeCollector: process.env.NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS || "0x",
  },
};

export function getRampContractAddresses(chainId: number) {
  if (chainId === 42220) {
    return RAMP_ADDRESSES.mainnet;
  }
  if (chainId === 44787) {
    return RAMP_ADDRESSES.alfajores;
  }
  throw new Error(`Unsupported chain: ${chainId}`);
}

/**
 * SpendRouter escrow contract (the contract the backend watches and can
 * complete/refund). The spend flow must use this, not the ramp aggregator.
 */
export function getSpendRouterAddress(chainId: number): `0x${string}` {
  const address =
    chainId === 44787
      ? process.env.NEXT_PUBLIC_SPEND_ROUTER_ADDRESS_ALFAJORES
      : chainId === 42220
        ? process.env.NEXT_PUBLIC_SPEND_ROUTER_ADDRESS
        : undefined;

  if (chainId !== 42220 && chainId !== 44787) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(
      `SpendRouter address not configured for chain ${chainId}. ` +
        `Set NEXT_PUBLIC_SPEND_ROUTER_ADDRESS(_ALFAJORES).`,
    );
  }
  return address as `0x${string}`;
}

export function parseAmount(amount: string | number, decimals: number = 18) {
  return parseUnits(amount.toString(), decimals);
}

export function formatAmount(
  amount: bigint | number,
  decimals: number = 18,
  displayDecimals: number = 2
) {
  const bigintAmount = typeof amount === "bigint" ? amount : BigInt(amount);
  const formatted = formatUnits(bigintAmount, decimals);
  return parseFloat(formatted).toFixed(displayDecimals);
}

export function calculateFee(amount: bigint, feeBps: number): bigint {
  return (amount * BigInt(feeBps)) / BigInt(10000);
}

export function calculateTotal(amount: bigint, feeBps: number): bigint {
  const fee = calculateFee(amount, feeBps);
  return amount + fee;
}

export function validateCeloAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
