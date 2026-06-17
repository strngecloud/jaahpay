/**
 * Wrapper for viem to avoid type checking issues with ox dependencies
 * This file imports viem types without triggering type checking on ox
 */

export * from 'viem';
export * from 'viem/accounts';
export { celo, celoAlfajores, base, baseSepolia } from 'viem/chains';
