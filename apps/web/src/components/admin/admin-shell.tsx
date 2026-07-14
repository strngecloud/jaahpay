"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useBlockNumber, useSignMessage } from "wagmi";
import {
  ArrowLeftRight,
  Bot,
  Coins,
  LayoutDashboard,
  LogOut,
  ServerCog,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WalletConnectButton } from "@/components/connect-button";
import { Callout, LoadingBlock, shortAddress } from "./ui";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/admin/fees", label: "Fees & Revenue", icon: Coins },
  { href: "/admin/agent", label: "AI Agent", icon: Sparkles },
  { href: "/admin/bots", label: "Bots & Jobs", icon: Bot },
  { href: "/admin/system", label: "System", icon: ServerCog },
];

type Session = { authenticated: boolean; address: string | null; configured: boolean };

function ChainPulse() {
  const { data: blockNumber } = useBlockNumber({
    watch: false,
    query: { refetchInterval: 15_000 },
  });
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Celo Mainnet</p>
        <p className="truncate font-mono text-xs tabular-nums text-white/80">
          {blockNumber ? `#${blockNumber.toLocaleString()}` : "connecting…"}
        </p>
      </div>
    </div>
  );
}

function SignInGate({
  session,
  onSignedIn,
}: {
  session: Session;
  onSignedIn: () => void;
}) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const { nonce, message, error: nonceError } = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceError || "Failed to get sign-in nonce");

      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature, nonce }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Sign-in failed");
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4">
      <div className="w-full rounded-2xl border border-white/[0.06] bg-[#0d111c]/80 p-8 backdrop-blur-xl">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-brand-blue/25 bg-brand-blue/10">
          <ShieldCheck className="h-5 w-5 text-brand-blue" />
        </div>
        <h1 className="text-xl font-bold text-white">Admin console</h1>
        <p className="mt-1.5 text-sm text-white/50">
          Sign a message with an authorized admin wallet to open the Jahpay operations console.
        </p>

        <div className="mt-6 space-y-3">
          {!session.configured && (
            <Callout tone="warning">
              Admin access isn&apos;t configured yet. Set{" "}
              <code className="font-mono">ADMIN_WALLET_ADDRESSES</code> and{" "}
              <code className="font-mono">ADMIN_SESSION_SECRET</code> in the server environment.
            </Callout>
          )}

          {!isConnected ? (
            <WalletConnectButton />
          ) : (
            <button
              onClick={signIn}
              disabled={busy || !session.configured}
              className="btn-cta h-11 w-full px-6 text-sm disabled:cursor-not-allowed"
            >
              {busy ? "Waiting for signature…" : `Sign in as ${shortAddress(address)}`}
            </button>
          )}

          {error && <Callout tone="error">{error}</Callout>}
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth", { cache: "no-store" });
      setSession(await res.json());
    } catch {
      setSession({ authenticated: false, address: null, configured: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    refresh();
  };

  if (!session) return <LoadingBlock label="Checking admin session…" />;
  if (!session.authenticated) return <SignInGate session={session} onSignedIn={refresh} />;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 pb-16 sm:px-6">
      <aside className="sticky top-24 hidden h-[calc(100vh-8rem)] w-52 shrink-0 flex-col md:flex">
        <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Operations
        </p>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-brand-blue/10 font-medium text-brand-blue"
                    : "text-white/55 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                {active && (
                  <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-blue" />
                )}
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2">
          <ChainPulse />
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
            <span className="ml-auto font-mono text-[10px] text-white/35">
              {shortAddress(session.address)}
            </span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile nav */}
        <nav
          aria-label="Admin"
          className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#0d111c]/80 p-1 md:hidden"
        >
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs",
                pathname === href
                  ? "bg-brand-blue/15 font-medium text-brand-blue"
                  : "text-white/55",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
