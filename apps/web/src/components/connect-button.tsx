"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/utils";

const pillBase =
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold h-10 px-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/70";

export function WalletConnectButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className={cn(pillBase, "bg-white/[0.06] text-white/40")}
        disabled
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted: rkMounted,
      }) => {
        const ready = rkMounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none" as const,
                userSelect: "none" as const,
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className={cn(
                      pillBase,
                      "bg-gradient-to-r from-brand-blue to-brand-green text-white",
                      "shadow-[0_0_20px_hsl(var(--brand-blue)/0.25)] hover:shadow-[0_0_30px_hsl(var(--brand-blue)/0.4)]",
                    )}
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className={cn(
                      pillBase,
                      "bg-destructive text-white hover:bg-destructive/90",
                    )}
                  >
                    Switch network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className={cn(
                      pillBase,
                      "hidden sm:inline-flex gap-1.5 border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white",
                    )}
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <span
                        className="h-4 w-4 overflow-hidden rounded-full shrink-0"
                        style={{ background: chain.iconBackground }}
                      >
                        <Image
                          alt={chain.name ?? "Chain icon"}
                          src={chain.iconUrl}
                          width={16}
                          height={16}
                        />
                      </span>
                    )}
                    {chain.name}
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className={cn(
                      pillBase,
                      "border border-brand-blue/30 bg-brand-blue/10 text-white hover:bg-brand-blue/20 font-mono text-xs",
                    )}
                  >
                    {account.displayName}
                    {account.displayBalance &&
                    !account.displayBalance.includes("NaN")
                      ? ` · ${account.displayBalance}`
                      : ""}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
