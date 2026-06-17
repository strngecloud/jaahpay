/**
 * Wrapper for viem to avoid type checking issues with ox dependencies
 * This file imports viem types without triggering type checking on ox
 */

// Export all viem types first
export * from 'viem';
// Export specific account functions
export { privateKeyToAccount } from 'viem/accounts';
// Export chains
export { celo, celoAlfajores, base, baseSepolia } from 'viem/chains';
