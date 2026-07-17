/**
 * Wrapper for viem to avoid type checking issues with ox dependencies.
 *
 * viem's type graph pulls in `ox`, which ships raw .ts sources that do not
 * compile under this tsconfig (non-strict, commonjs). Loading viem via
 * require() keeps tsc from ever traversing those sources. Consumers get
 * loosely-typed bindings, matching how BlockchainService already types its
 * clients (`any`).
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const viem = require('viem');
const viemAccounts = require('viem/accounts');
const viemChains = require('viem/chains');

export type WatchContractEventReturnType = () => void;

export const createPublicClient: (config: any) => any =
  viem.createPublicClient;
export const createWalletClient: (config: any) => any =
  viem.createWalletClient;
export const http: (url?: string) => any = viem.http;
export const parseAbiItem: (signature: string) => any = viem.parseAbiItem;

export const privateKeyToAccount: (privateKey: `0x${string}`) => any =
  viemAccounts.privateKeyToAccount;

export const celo: any = viemChains.celo;
export const celoSepolia: any = viemChains.celoSepolia;
export const base: any = viemChains.base;
export const baseSepolia: any = viemChains.baseSepolia;
