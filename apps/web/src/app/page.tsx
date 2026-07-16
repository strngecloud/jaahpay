import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { LiveRate } from "@/components/landing/live-rate";

// ─── Content ──────────────────────────────────────────────────────────────────

const RECEIPT_ROWS: Array<{
  label: string;
  value: string;
  strong?: boolean;
  rule?: boolean;
}> = [
  { label: "YOU SEND", value: "100.00 USDC" },
  { label: "ORACLE RATE", value: "₦1,648.52 / USDC" },
  { label: "FEE — 0.30%", value: "0.30 USDC" },
  { label: "RECIPIENT GETS", value: "₦164,357", strong: true, rule: true },
  { label: "BANK", value: "GTBANK ····0231" },
  { label: "TIME TO SETTLE", value: "4.2s" },
  { label: "AGENT CHECK", value: "SLIPPAGE 0.1% · OK" },
];

const RAILS = [
  {
    code: "ORACLE-PX",
    title: "Oracle pricing, not curve pricing",
    desc: "Rates come from Mento and Uniswap oracles, so the number you're quoted is the number that settles. No AMM slippage, no sandwich risk.",
  },
  {
    code: "NGN-RAIL",
    title: "Naira payouts to any bank",
    desc: "Send USDC straight to a Nigerian bank account at the live rate. Flat 0.3% fee, delivered in minutes.",
  },
  {
    code: "ERC-8004",
    title: "An agent that signs its work",
    desc: "A registered on-chain agent reads market conditions and recommends slippage before every swap — and records the outcome afterwards.",
  },
  {
    code: "GAS-ABS",
    title: "Gas paid in stables",
    desc: "Celo's fee abstraction lets you pay gas in USDC or USDT. You never need to hold CELO.",
  },
  {
    code: "SELF-CUST",
    title: "Your keys the whole way",
    desc: "Swaps execute directly from your wallet. Jahpay never takes custody of your funds.",
  },
  {
    code: "CIRCUIT",
    title: "Volatility-aware by default",
    desc: "Mento's circuit breaker pauses trading during extreme moves — and the app tells you before you sign, not after.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Connect",
    desc: "Link any Celo wallet — MetaMask, Valora, or anything on WalletConnect.",
  },
  {
    num: "02",
    title: "Quote",
    desc: "Enter an amount. A live oracle quote appears with the full fee breakdown.",
  },
  {
    num: "03",
    title: "Agent check",
    desc: "The ERC-8004 agent reads conditions and recommends the safest slippage.",
  },
  {
    num: "04",
    title: "Settle",
    desc: "Confirm once. Settlement lands on Celo in under five seconds.",
  },
];

const AUDIT_TRAIL = [
  {
    block: "BLK 28,441,203",
    kind: "IDENTITY",
    detail: "Registered as ERC-8004 agent (ERC-721)",
  },
  {
    block: "BLK 29,102,377",
    kind: "RECOMMEND",
    detail: "Slippage 0.1% — oracle spread stable",
  },
  {
    block: "BLK 29,102,391",
    kind: "SETTLE",
    detail: "100 USDC → 99.70 USDT via Mento v3",
  },
  {
    block: "BLK 29,102,402",
    kind: "FEEDBACK",
    detail: "+1 reputation — recorded on-chain",
  },
];

const FAQS = [
  {
    q: "What tokens can I swap?",
    a: "Jahpay supports USDC ↔ USDT on Celo Mainnet. Both are native, audited stablecoins — not bridged versions.",
  },
  {
    q: "How does the AI agent work?",
    a: "The ERC-8004 agent is registered on-chain as an ERC-721 on Celo. It monitors Mento oracle rates and recommends optimal slippage before each swap. After completion, it records feedback on-chain to build its reputation.",
  },
  {
    q: "What is the platform fee?",
    a: "0.3% on every swap, deducted from the output amount. It is always shown before you confirm.",
  },
  {
    q: "Can I send money to a bank account?",
    a: "Yes. The Spend tab converts your USDC to Naira at a live rate and delivers it to any Nigerian bank account, usually within minutes.",
  },
  {
    q: "Do I need CELO for gas?",
    a: "No. Celo's fee abstraction lets you pay gas in USDC or USDT directly.",
  },
  {
    q: "Is this safe?",
    a: "Swaps are executed through Mento Protocol v3 — a battle-tested, audited DEX native to Celo. Jahpay never holds your funds.",
  },
];

const CELOSCAN_USDC =
  "https://celoscan.io/token/0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const ERC8004_DOCS = "https://docs.celo.org/build-on-celo/build-with-ai/8004";

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-[0.22em] text-gold">
      {children}
    </p>
  );
}

function SettlementReceipt() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* Printer slot */}
      <div className="mx-6 h-2.5 rounded-full bg-black/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]" />

      <div className="mx-2 -mt-1 bg-paper text-ink-0 font-mono text-[13px] leading-relaxed shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]">
        <div className="px-6 pt-6 pb-4">
          <div
            className="print-line flex items-baseline justify-between"
            style={{ animationDelay: "0.2s" }}
          >
            <span className="font-semibold tracking-widest">JAHPAY</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[hsl(147_60%_30%)]">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              SETTLED
            </span>
          </div>
          <p
            className="print-line mt-1 text-[11px] text-ink-0/55"
            style={{ animationDelay: "0.35s" }}
          >
            SETTLEMENT RECEIPT · CELO MAINNET · MENTO V3
          </p>

          <div
            className="print-line my-4 border-t border-dashed border-ink-0/25"
            style={{ animationDelay: "0.5s" }}
          />

          {RECEIPT_ROWS.map(({ label, value, strong, rule }, i) => (
            <div key={label}>
              {rule && (
                <div
                  className="print-line my-3 border-t border-dashed border-ink-0/25"
                  style={{ animationDelay: `${0.6 + i * 0.14}s` }}
                />
              )}
              <div
                className={`print-line flex items-baseline justify-between gap-4 py-0.5 ${
                  strong ? "text-[15px] font-semibold" : ""
                }`}
                style={{ animationDelay: `${0.65 + i * 0.14}s` }}
              >
                <span className={strong ? "" : "text-ink-0/55"}>{label}</span>
                <span className="text-right tabular-nums">{value}</span>
              </div>
            </div>
          ))}

          <div
            className="print-line my-4 border-t border-dashed border-ink-0/25"
            style={{ animationDelay: "1.75s" }}
          />

          <div
            className="print-line barcode text-ink-0/85"
            style={{ animationDelay: "1.85s" }}
          />
          <a
            href={CELOSCAN_USDC}
            target="_blank"
            rel="noopener noreferrer"
            className="print-line mt-3 flex items-center justify-between text-[11px] text-ink-0/55 hover:text-ink-0 transition-colors"
            style={{ animationDelay: "1.95s" }}
          >
            <span>TX 0x7f3a····c9e2</span>
            <span className="inline-flex items-center gap-1">
              CELOSCAN <ArrowUpRight className="h-3 w-3" />
            </span>
          </a>
        </div>
      </div>
      <div className="tear-bottom mx-2" />
    </div>
  );
}

function TapeItems() {
  return (
    <div className="flex shrink-0 items-center font-mono text-xs tracking-wider text-white/60">
      <span className="mx-7 inline-flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" />
        USDC/NGN <LiveRate base={1648.52} prefix="₦" />
      </span>
      <span className="text-gold/70">◆</span>
      <span className="mx-7">
        USDT/USDC <span className="text-white/80 tabular-nums">0.9997</span>
      </span>
      <span className="text-gold/70">◆</span>
      <span className="mx-7">PLATFORM FEE 0.30% FLAT</span>
      <span className="text-gold/70">◆</span>
      <span className="mx-7">SETTLEMENT &lt; 5 SEC</span>
      <span className="text-gold/70">◆</span>
      <span className="mx-7">GAS PAYABLE IN USDC · USDT</span>
      <span className="text-gold/70">◆</span>
      <span className="mx-7">
        MENTO CIRCUIT <span className="text-mint">NORMAL</span>
      </span>
      <span className="text-gold/70">◆</span>
      <span className="mx-7">
        ERC-8004 AGENT <span className="text-mint">ACTIVE</span>
      </span>
      <span className="text-gold/70">◆</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="flex-1 overflow-x-hidden bg-ink-0">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-20 lg:pt-44 lg:pb-24">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8">
              <Eyebrow>CELO MAINNET · ORACLE-PRICED · NON-CUSTODIAL</Eyebrow>

              <h1 className="font-display text-6xl font-bold leading-[0.95] tracking-tight text-paper sm:text-7xl xl:text-8xl">
                Stables in.
                <br />
                <span className="text-mint">Naira out.</span>
              </h1>

              <p className="max-w-xl text-lg leading-relaxed text-white/55">
                Jahpay swaps USDC and USDT at the Mento oracle price and pays
                out to any Nigerian bank account in minutes. A flat 0.3% fee,
                gas paid in stables, and an on-chain agent checking conditions
                before you sign.
              </p>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Link href="/app" className="btn-mint px-8 py-4 text-base">
                  Open the app <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={CELOSCAN_USDC}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-quiet px-8 py-4 text-base"
                >
                  View the contract <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>

              <p className="font-mono text-[11px] tracking-[0.18em] text-white/30">
                NO CELO NEEDED FOR GAS — FEE ABSTRACTION IS NATIVE
              </p>
            </div>

            <div className="relative">
              <SettlementReceipt />
            </div>
          </div>
        </div>
      </section>

      {/* ── Market tape ──────────────────────────────────────────── */}
      <div
        className="overflow-hidden border-y border-white/[0.07] bg-ink-1/70 py-3"
        aria-label="Indicative market rates"
      >
        <div className="tape-track flex">
          <TapeItems />
          <TapeItems />
        </div>
      </div>

      {/* ── Rails ────────────────────────────────────────────────── */}
      <section id="features" className="py-24 lg:py-32">
        <div className="container mx-auto max-w-6xl px-4">
          <Reveal className="max-w-2xl space-y-4">
            <Eyebrow>THE RAILS</Eyebrow>
            <h2 className="font-display text-4xl font-bold tracking-tight text-paper md:text-5xl">
              Built like a payment rail.
            </h2>
            <p className="text-lg leading-relaxed text-white/50">
              Every piece of Jahpay exists to move value predictably — priced
              by oracles, guarded by circuit breakers, settled from your own
              wallet.
            </p>
          </Reveal>

          <div className="mt-14 border-t border-white/[0.08]">
            {RAILS.map(({ code, title, desc }, i) => (
              <Reveal key={code} delay={Math.min(i * 60, 240)}>
                <div className="group grid gap-2 border-b border-white/[0.08] py-6 transition-colors hover:bg-white/[0.02] md:grid-cols-[170px_260px_1fr] md:items-baseline md:gap-8 md:px-4">
                  <span className="font-mono text-xs tracking-[0.18em] text-mint/80 transition-colors group-hover:text-mint">
                    {code}
                  </span>
                  <h3 className="text-base font-bold text-white">{title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">
                    {desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How a swap settles ───────────────────────────────────── */}
      <section id="how-it-works" className="py-24 lg:py-32">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <Reveal className="space-y-4">
              <Eyebrow>EXECUTION</Eyebrow>
              <h2 className="font-display text-4xl font-bold tracking-tight text-paper md:text-5xl">
                Quote to settlement in four moves.
              </h2>
              <p className="text-lg leading-relaxed text-white/50">
                The whole flow happens in one screen, with the fee breakdown
                and the agent's read on conditions shown before you commit to
                anything.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="rounded-xl border border-white/[0.09] bg-ink-1 p-2 font-mono">
                <p className="px-5 pt-4 pb-2 text-[11px] tracking-[0.2em] text-white/35">
                  EXECUTION LOG — TYPICAL SWAP
                </p>
                {STEPS.map(({ num, title, desc }) => (
                  <div
                    key={num}
                    className="flex items-baseline gap-5 border-t border-white/[0.06] px-5 py-4"
                  >
                    <span className="text-sm text-mint">{num}</span>
                    <div>
                      <p className="text-sm font-semibold tracking-wide text-white">
                        {title.toUpperCase()}
                      </p>
                      <p className="mt-1 font-sans text-sm leading-relaxed text-white/50">
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Agent ────────────────────────────────────────────────── */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <Reveal className="space-y-6">
              <Eyebrow>ON-CHAIN AGENT</Eyebrow>
              <h2 className="font-display text-4xl font-bold tracking-tight text-paper md:text-5xl">
                Advice with a paper trail.
              </h2>
              <p className="leading-relaxed text-white/50">
                The Jahpay swap agent is a registered ERC-8004 identity on
                Celo — an ERC-721 with a public record. Every recommendation
                and every assisted swap is written to chain, building a
                reputation you can audit instead of a promise you have to
                trust.
              </p>
              <a
                href={ERC8004_DOCS}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-mint hover:text-paper transition-colors"
              >
                READ THE ERC-8004 SPEC <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </Reveal>

            <Reveal delay={120}>
              <div className="rounded-xl border border-white/[0.09] bg-ink-1 p-2 font-mono">
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <p className="text-[11px] tracking-[0.2em] text-white/35">
                    AUDIT TRAIL — JAHPAY SWAP AGENT
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-mint">
                    <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" />
                    LIVE
                  </span>
                </div>
                {AUDIT_TRAIL.map(({ block, kind, detail }) => (
                  <div
                    key={block + kind}
                    className="grid gap-1 border-t border-white/[0.06] px-5 py-4 text-xs sm:grid-cols-[130px_100px_1fr] sm:gap-4"
                  >
                    <span className="tabular-nums text-white/35">{block}</span>
                    <span className="tracking-wider text-gold">{kind}</span>
                    <span className="text-white/70">{detail}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 lg:py-32">
        <div className="container mx-auto max-w-3xl px-4">
          <Reveal className="mb-12 space-y-4">
            <Eyebrow>QUESTIONS</Eyebrow>
            <h2 className="font-display text-4xl font-bold tracking-tight text-paper">
              Asked and answered.
            </h2>
          </Reveal>

          <Reveal>
            <div className="border-t border-white/[0.08]">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group border-b border-white/[0.08]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
                    {q}
                    <span
                      aria-hidden="true"
                      className="font-mono text-lg font-normal text-mint transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-5 pr-8 text-sm leading-relaxed text-white/50">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Paper CTA band ───────────────────────────────────────── */}
      <section className="relative mt-8">
        <div className="tear-top absolute inset-x-0 -top-[10px]" />
        <div className="bg-paper text-ink-0">
          <div className="container mx-auto max-w-6xl px-4 py-20">
            <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-end">
              <div className="space-y-4">
                <p className="font-mono text-[11px] tracking-[0.22em] text-ink-0/50">
                  NEXT RECEIPT: YOURS
                </p>
                <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
                  Ready when your wallet is.
                </h2>
                <p className="max-w-md leading-relaxed text-ink-0/60">
                  Connect, get an oracle quote, and settle your first swap in
                  under five seconds.
                </p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row md:shrink-0">
                <Link href="/app" className="btn-ink px-8 py-4">
                  Open the app <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={ERC8004_DOCS}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-0/20 px-8 py-4 font-medium text-ink-0/75 transition-colors hover:border-ink-0/45 hover:text-ink-0"
                >
                  ERC-8004 docs <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
