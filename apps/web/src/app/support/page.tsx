"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  LifeBuoy,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createSupportTicket,
  fetchSupportTickets,
  type SupportTicket,
  type SupportTicketCategory,
} from "@/lib/support/api";

export const dynamic = "force-dynamic";

const CATEGORIES: { value: SupportTicketCategory; label: string }[] = [
  { value: "transaction", label: "Transaction issue" },
  { value: "payment", label: "Bank payment / payout" },
  { value: "account", label: "Wallet & account" },
  { value: "technical", label: "Technical problem" },
  { value: "other", label: "Something else" },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "My transfer says complete but the bank hasn't received it",
    a: "Bank credits usually land within 2–5 minutes. If your receipt shows SETTLED with a bank reference and the money still hasn't arrived after 30 minutes, open a ticket below with your transaction attached — the reference lets us trace it with the bank instantly.",
  },
  {
    q: "My transaction failed — where is my USDC?",
    a: "Failed spends are automatically refunded to your wallet by the SpendRouter escrow contract. Check the transaction on Celoscan from your receipt. If the refund hasn't appeared after 15 minutes, open a ticket with the transaction attached.",
  },
  {
    q: "How is the exchange rate determined?",
    a: "Rates come from multiple independent oracle sources and are locked when you confirm the transfer. The rate on your receipt is exactly what was executed — there are no hidden spreads, only the flat 0.3% fee shown upfront.",
  },
  {
    q: "How do I download or share a receipt?",
    a: "After a transfer completes, tap “View Receipt”. You can download it as an image or share it directly. Every receipt also has a permanent link (jahpay.app/receipt/…) you can send to the recipient as proof of payment.",
  },
  {
    q: "Is Jahpay custodial?",
    a: "No. Your funds move from your wallet through an on-chain escrow contract and are only released when the bank payout succeeds. We never hold your keys or your tokens.",
  },
];

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_progress: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  resolved: "bg-green-500/10 text-green-500 border-green-500/20",
  closed: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-sm font-medium text-white/90">{q}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-white/40 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <p className="px-4 pb-4 text-sm text-white/50 leading-relaxed">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputClasses =
  "w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-green/50 transition-colors";

function TicketForm({ prefillSpendId }: { prefillSpendId: string | null }) {
  const { address } = useAccount();
  const [category, setCategory] = useState<SupportTicketCategory>(
    prefillSpendId ? "transaction" : "other",
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [spendId, setSpendId] = useState(prefillSpendId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SupportTicket | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await createSupportTicket({
        userAddress: address,
        email: email.trim() || undefined,
        category,
        subject: subject.trim(),
        message: message.trim(),
        spendId: spendId.trim() || undefined,
      });
      setCreated(ticket);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit your ticket",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl bg-brand-green/[0.08] border border-brand-green/25 p-6 text-center space-y-3"
      >
        <CheckCircle2 className="w-10 h-10 text-brand-green mx-auto" />
        <h3 className="text-lg font-bold text-white">Ticket submitted</h3>
        <p className="text-sm text-white/60">
          Your reference is{" "}
          <span className="font-mono font-bold text-brand-green">
            {created.ticketRef}
          </span>
          . Keep it handy — we&apos;ll follow up
          {created.spendId ? " on your transaction" : ""} as soon as possible
          {email.trim() ? ` at ${email.trim()}` : ""}.
        </p>
        <button
          type="button"
          onClick={() => {
            setCreated(null);
            setSubject("");
            setMessage("");
          }}
          className="text-xs text-white/40 hover:text-white transition-colors"
        >
          Submit another ticket
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as SupportTicketCategory)
            }
            className={inputClasses}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value} className="bg-[#0d111c]">
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1.5">
            Email (optional, for updates)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1.5">Subject</label>
        <input
          type="text"
          required
          minLength={3}
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief summary of the issue"
          className={inputClasses}
        />
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1.5">
          Transaction ID (optional)
        </label>
        <input
          type="text"
          value={spendId}
          onChange={(e) => setSpendId(e.target.value)}
          placeholder="Attach a transaction to this ticket"
          className={cn(inputClasses, "font-mono text-xs")}
        />
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1.5">
          What happened?
        </label>
        <textarea
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the issue — amounts, timing, and anything you've already tried"
          className={cn(inputClasses, "resize-y min-h-[120px]")}
        />
      </div>

      {address && (
        <p className="text-[11px] text-white/30 font-mono">
          Wallet {address.slice(0, 6)}…{address.slice(-4)} will be attached to
          this ticket.
        </p>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/[0.08] border border-red-500/25 flex items-start gap-3 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full h-12 rounded-2xl text-sm font-bold bg-gradient-to-r from-brand-blue to-brand-green text-white shadow-[0_0_20px_rgba(38,161,123,0.25)] disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting…
          </>
        ) : (
          "Submit ticket"
        )}
      </button>
    </form>
  );
}

function MyTickets() {
  const { address } = useAccount();
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);

  useEffect(() => {
    if (!address) {
      setTickets(null);
      return;
    }
    let cancelled = false;
    fetchSupportTickets(address)
      .then((res) => {
        if (!cancelled) setTickets(res.tickets);
      })
      .catch(() => {
        if (!cancelled) setTickets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!address || !tickets || tickets.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Ticket className="w-4 h-4 text-brand-green" />
        Your tickets
      </h2>
      {tickets.map((t) => (
        <div
          key={t.ticketRef}
          className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-sm text-white/90 truncate">{t.subject}</p>
            <p className="text-[11px] font-mono text-white/40 mt-0.5">
              {t.ticketRef}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize",
              STATUS_STYLES[t.status] ?? STATUS_STYLES.open,
            )}
          >
            {t.status.replace("_", " ")}
          </span>
        </div>
      ))}
    </section>
  );
}

function SupportPageContent() {
  const searchParams = useSearchParams();
  const prefillSpendId = searchParams.get("spendId");

  return (
    <main className="flex-1 min-h-screen jahpay-bg jahpay-grid">
      <div className="absolute inset-0 -z-10 section-overlay-hero" />
      <div className="container max-w-2xl mx-auto px-4 py-10 relative z-10 space-y-10">
        <div>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-green/10 border border-brand-green/25 flex items-center justify-center">
              <LifeBuoy className="w-5 h-5 text-brand-green" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Support</h1>
              <p className="text-sm text-white/50">
                Answers to common questions, or open a ticket and we&apos;ll
                take it from there.
              </p>
            </div>
          </div>
        </div>

        <MyTickets />

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">
            Frequently asked questions
          </h2>
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">Open a ticket</h2>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <TicketForm prefillSpendId={prefillSpendId} />
          </div>
          <p className="text-xs text-white/30 text-center">
            Prefer email? Reach us at{" "}
            <a
              href="mailto:hello@jahpay.app"
              className="text-brand-blue/70 hover:text-brand-blue"
            >
              hello@jahpay.app
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportPageContent />
    </Suspense>
  );
}
