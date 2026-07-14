import { createPublicClient, http, formatUnits } from "viem";
import { celo } from "viem/chains";
import {
  SWAP_TOKENS,
  JAHPAY_ROUTER_ADDRESS,
  FEE_COLLECTOR_ADDRESS,
} from "@/lib/minipay/constants";

/** Server-side Celo read client for admin endpoints. */

type Address = `0x${string}`;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.ARB_RPC_URL || "https://forno.celo.org"),
});

const ROUTER_ABI = [
  {
    name: "feeCollector",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const FEE_COLLECTOR_ABI = [
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "collectedFees",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export function isConfiguredAddress(address: string | undefined): address is Address {
  return !!address && /^0x[a-fA-F0-9]{40}$/.test(address) && address !== ZERO_ADDRESS;
}

/** Resolve the live FeeCollector: prefer what the router points at, fall back to env. */
export async function resolveFeeCollector(): Promise<Address | null> {
  if (isConfiguredAddress(JAHPAY_ROUTER_ADDRESS)) {
    try {
      const onChain = (await publicClient.readContract({
        address: JAHPAY_ROUTER_ADDRESS as Address,
        abi: ROUTER_ABI,
        functionName: "feeCollector",
      })) as Address;
      if (isConfiguredAddress(onChain)) return onChain;
    } catch {
      // fall through to env
    }
  }
  return isConfiguredAddress(FEE_COLLECTOR_ADDRESS) ? (FEE_COLLECTOR_ADDRESS as Address) : null;
}

export interface FeeTokenBalance {
  symbol: string;
  address: string;
  decimals: number;
  /** Raw ERC20 balance sitting on the FeeCollector */
  balance: string;
  /** Amount the contract's accounting says is withdrawable */
  withdrawable: string;
  /** balance - withdrawable: fees the deployed contract can't release */
  stuck: string;
}

export async function getFeeCollectorReport() {
  const feeCollector = await resolveFeeCollector();
  if (!feeCollector) return { feeCollector: null, owner: null, tokens: [] as FeeTokenBalance[] };

  const [owner, ...tokenReads] = await Promise.all([
    publicClient
      .readContract({ address: feeCollector, abi: FEE_COLLECTOR_ABI, functionName: "owner" })
      .catch(() => null),
    ...SWAP_TOKENS.map(async (token) => {
      const [balance, collected] = await Promise.all([
        publicClient
          .readContract({
            address: token.address as Address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [feeCollector],
          })
          .catch(() => 0n),
        publicClient
          .readContract({
            address: feeCollector,
            abi: FEE_COLLECTOR_ABI,
            functionName: "collectedFees",
            args: [token.address as Address],
          })
          .catch(() => 0n),
      ]);
      const withdrawable = collected < balance ? collected : balance;
      return {
        symbol: token.symbol,
        address: token.address,
        decimals: token.decimals,
        balance: formatUnits(balance, token.decimals),
        withdrawable: formatUnits(withdrawable, token.decimals),
        stuck: formatUnits(balance - withdrawable, token.decimals),
      } satisfies FeeTokenBalance;
    }),
  ]);

  return { feeCollector, owner: owner as string | null, tokens: tokenReads };
}
