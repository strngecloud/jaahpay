"use client";

import { ReactNode, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared building blocks for the admin console. Figures always render in
 * mono/tabular numerals so columns of data line up like instrumentation. */

export async function fetchAdmin<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body as T;
}

export function formatUsd(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function shortAddress(address?: string | null): string {
  if (!address) return "—";
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-[#0d111c]/80 backdrop-blur-xl",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3.5">
          {title && (
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "blue" | "green" | "purple";
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0d111c]/80 px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-mono text-2xl font-semibold tabular-nums text-white",
          accent === "blue" && "text-brand-blue",
          accent === "green" && "text-brand-green",
          accent === "purple" && "text-brand-purple",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-white/45">{sub}</p>}
    </div>
  );
}

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  completed: { dot: "bg-brand-green", text: "text-brand-green" },
  processing: { dot: "bg-brand-blue", text: "text-brand-blue" },
  pending: { dot: "bg-amber-400", text: "text-amber-400" },
  failed: { dot: "bg-red-400", text: "text-red-400" },
  cancelled: { dot: "bg-white/40", text: "text-white/50" },
};

export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.cancelled;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-xs font-medium",
        style.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {status}
    </span>
  );
}

export function OkPill({ ok, labels }: { ok: boolean; labels?: [string, string] }) {
  const [okLabel, badLabel] = labels || ["operational", "down"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-xs font-medium",
        ok ? "text-brand-green" : "text-red-400",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-brand-green" : "bg-red-400")} />
      {ok ? okLabel : badLabel}
    </span>
  );
}

export function AddressChip({
  address,
  href,
  explorer = "address",
}: {
  address?: string | null;
  href?: string;
  explorer?: "address" | "tx" | false;
}) {
  const [copied, setCopied] = useState(false);
  if (!address) return <span className="text-white/40">—</span>;

  const explorerHref =
    href || (explorer ? `https://celoscan.io/${explorer === "tx" ? "tx" : "address"}/${address}` : undefined);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-white/80">
      {shortAddress(address)}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy address"}
        className="text-white/35 transition-colors hover:text-white"
      >
        {copied ? <Check className="h-3 w-3 text-brand-green" /> : <Copy className="h-3 w-3" />}
      </button>
      {explorerHref && (
        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View on CeloScan"
          className="text-white/35 transition-colors hover:text-white"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </span>
  );
}

export function Callout({
  tone,
  children,
}: {
  tone: "info" | "warning" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "info" && "border-brand-blue/25 bg-brand-blue/[0.07] text-brand-blue",
        tone === "warning" && "border-amber-400/25 bg-amber-400/[0.07] text-amber-300",
        tone === "error" && "border-red-400/25 bg-red-400/[0.07] text-red-300",
      )}
    >
      {children}
    </div>
  );
}

export function TableShell({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.12em] text-white/40">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm text-white/40">
        {message}
      </td>
    </tr>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/40">
      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
      {label}
    </div>
  );
}
