"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, ArrowUpRight, History } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "@/components/connect-button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Navbar() {
  const pathname = usePathname();
  const [prevScrollPos, setPrevScrollPos] = useState(0);
  const [visible, setVisible] = useState(true);
  const isAppPage = pathname.startsWith("/app");

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.scrollY;

      // Always show navbar near the top of the page
      if (currentScrollPos < 10) {
        setVisible(true);
        setPrevScrollPos(currentScrollPos);
        return;
      }

      setVisible(currentScrollPos < prevScrollPos);
      setPrevScrollPos(currentScrollPos);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [prevScrollPos]);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 w-full surface-glass border-b border-white/[0.05] transition-transform duration-300 ease-in-out",
        visible ? "translate-y-0" : "-translate-y-full",
      )}
    >
      <div className="container flex h-20 items-center justify-between px-6 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          aria-label="Jahpay home"
        >
          <Image
            src="/images/logo_name.png"
            alt="Jahpay"
            width={120}
            height={20}
            style={{ height: "auto" }}
            priority
          />
        </Link>

        <div className="flex items-center gap-3">
          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-3">
            {!isAppPage ? (
              <Button variant="outline" asChild>
                <Link href="/app">
                  Go to App
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" asChild>
                <Link href="/transactions">
                  <History className="h-4 w-4" />
                  Transactions
                </Link>
              </Button>
            )}
          </nav>

          <WalletConnectButton />

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 bg-surface-1 border-r border-white/[0.06]"
            >
              <div className="flex flex-col h-full px-4 py-6">
                <Link href="/" className="mb-8" aria-label="Jahpay home">
                  <Image
                    src="/images/logo_name.png"
                    alt="Jahpay"
                    width={140}
                    height={24}
                    style={{ height: "auto" }}
                    priority
                  />
                </Link>

                <nav className="flex flex-col gap-2">
                  {!isAppPage && (
                    <Link
                      href="/app"
                      className="flex items-center justify-between rounded-xl border border-brand-blue/35 bg-brand-blue/10 px-4 py-3 text-sm font-semibold text-white hover:border-brand-blue/55 hover:bg-brand-blue/15 transition-colors"
                    >
                      Go to App
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  )}
                  <Link
                    href="/transactions"
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors"
                  >
                    Transactions
                    <History className="h-4 w-4" />
                  </Link>
                  <a
                    href="https://docs.celo.org/build-on-celo/build-with-ai/8004"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors"
                  >
                    ERC-8004 Docs
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </nav>

                <div className="mt-auto pt-6 border-t border-white/[0.06]">
                  <WalletConnectButton />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
