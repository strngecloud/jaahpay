"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import { getStablecoinBalance } from "@/lib/minipay/utils";
import { SWAP_TOKENS } from "@/lib/minipay/constants";
import type { SwapTokenSymbol } from "@/lib/swap/usdc-usdt-swap";

export function useTokenBalances() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const [balances, setBalances] = useState<Record<SwapTokenSymbol, string | null>>({
        USDC: null,
        USDT: null,
        CELO: null,
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!address || !isConnected) {
            setBalances({ USDC: null, USDT: null, CELO: null });
            return;
        }

        const fetchAllBalances = async () => {
            setIsLoading(true);
            try {
                const newBalances: Record<SwapTokenSymbol, string | null> = {
                    USDC: null,
                    USDT: null,
                    CELO: null,
                };

                for (const token of SWAP_TOKENS) {
                    try {
                        const balance = await getStablecoinBalance(
                            address,
                            token.symbol as SwapTokenSymbol,
                            chainId
                        );
                        newBalances[token.symbol as SwapTokenSymbol] = balance;
                    } catch (error) {
                        console.error(`Failed to fetch ${token.symbol} balance:`, error);
                        newBalances[token.symbol as SwapTokenSymbol] = null;
                    }
                }

                setBalances(newBalances);
            } catch (error) {
                console.error("Failed to fetch token balances:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllBalances();
    }, [address, chainId, isConnected]);

    return { balances, isLoading };
}
