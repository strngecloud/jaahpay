// @ts-nocheck
/**
 * Wrapper for viem to avoid type checking issues with ox dependencies
 * This file imports viem types without triggering type checking on ox
 */

export * from 'viem';
export * from 'viem/accounts';
export const celo = require('viem/chains').celo;
export const celoAlfajores = require('viem/chains').celoAlfajores;
export const base = require('viem/chains').base;
export const baseSepolia = require('viem/chains').baseSepolia;
