"use client";

import type { SpendStatusResponse } from "./types";

/** Everything needed to render a settlement receipt (DOM or PNG). */
export interface SpendReceiptData {
  spendId: string;
  status: SpendStatusResponse["status"] | string;
  /** Display label, e.g. "CELO MAINNET" or "CELO SEPOLIA" */
  network: string;
  usdcAmount: number;
  ngnAmount: number;
  exchangeRate: number;
  platformFee: number;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  bankReference?: string;
  narration?: string;
  txHash?: string;
  createdAt?: string;
  completedAt?: string;
}

export function buildReceiptFromStatus(
  status: SpendStatusResponse,
  opts?: { txHash?: string | null; network?: string; bankName?: string },
): SpendReceiptData {
  const chain = (status.chain || "celo").toLowerCase();
  const network =
    opts?.network ?? (chain === "base" ? "BASE" : "CELO MAINNET");

  return {
    spendId: status.spendId,
    status: status.status,
    network,
    usdcAmount: status.usdcAmount,
    ngnAmount: status.ngnAmount,
    exchangeRate: status.exchangeRate,
    platformFee: status.platformFee,
    bankName: opts?.bankName ?? status.recipient?.bank,
    accountNumber: status.recipient?.accountNumber,
    accountName: status.recipient?.accountName,
    bankReference: status.bankReference,
    narration: status.narration,
    txHash: opts?.txHash ?? status.transactionHash,
    createdAt: status.createdAt,
    completedAt: status.completedAt,
  };
}

// ── Display formatting (shared by the DOM card and the PNG renderer) ──

export interface ReceiptDisplay {
  statusLabel: string;
  statusTone: "green" | "amber" | "red";
  subtitle: string;
  youSend: string;
  rate: string;
  feeLabel: string;
  fee: string;
  recipientGets: string;
  bank: string;
  account: string;
  settleTime: string;
  reference?: string;
  txShort?: string;
  explorerUrl?: string;
  dateLabel: string;
}

const NGN = "₦";

function formatNgn(amount: number): string {
  return `${NGN}${Math.round(amount).toLocaleString("en-NG")}`;
}

export function explorerTxUrl(network: string, txHash: string): string {
  if (network.toUpperCase().includes("SEPOLIA")) {
    return `https://celo-sepolia.blockscout.com/tx/${txHash}`;
  }
  return `https://celoscan.io/tx/${txHash}`;
}

export function receiptDisplay(data: SpendReceiptData): ReceiptDisplay {
  const status = String(data.status).toLowerCase();
  const statusLabel =
    status === "completed"
      ? "SETTLED"
      : status === "failed"
        ? "FAILED"
        : status.toUpperCase();
  const statusTone =
    status === "completed"
      ? "green"
      : status === "failed" || status === "cancelled"
        ? "red"
        : "amber";

  const feePct =
    data.usdcAmount > 0 ? (data.platformFee / data.usdcAmount) * 100 : 0;

  let settleTime = "—";
  if (data.createdAt && data.completedAt) {
    const secs =
      (new Date(data.completedAt).getTime() -
        new Date(data.createdAt).getTime()) /
      1000;
    if (secs > 0) {
      settleTime =
        secs < 100
          ? `${secs.toFixed(1)}s`
          : `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
    }
  }

  const last4 = data.accountNumber?.slice(-4);
  const txShort = data.txHash
    ? `${data.txHash.slice(0, 6)}····${data.txHash.slice(-4)}`
    : undefined;

  return {
    statusLabel,
    statusTone,
    subtitle: `SETTLEMENT RECEIPT · ${data.network} · MENTO`,
    youSend: `${data.usdcAmount.toFixed(2)} USDC`,
    rate: `${NGN}${data.exchangeRate.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} / USDC`,
    feeLabel: feePct > 0 ? `FEE — ${feePct.toFixed(2)}%` : "FEE",
    fee: `${data.platformFee.toFixed(2)} USDC`,
    recipientGets: formatNgn(data.ngnAmount),
    bank: `${(data.bankName || "BANK").toUpperCase()}${
      last4 ? ` ····${last4}` : ""
    }`,
    account: data.accountName?.toUpperCase() ?? "",
    settleTime,
    reference: data.bankReference,
    txShort,
    explorerUrl: data.txHash
      ? explorerTxUrl(data.network, data.txHash)
      : undefined,
    dateLabel: data.createdAt
      ? new Date(data.createdAt)
          .toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          .toUpperCase()
      : "",
  };
}

/** Deterministic pseudo-random bar widths from a seed (for the barcode strip) */
export function barcodePattern(seed: string, bars = 56): number[] {
  const out: number[] = [];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = 0; i < bars; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out.push((Math.abs(h) % 3) + 1);
  }
  return out;
}

// ── PNG rendering / download / share ──────────────────────────────────

const PAPER = "#f7f2e8";
const INK = "#16160f";
const MUTED = "#8a836e";
const RULE = "#c9c2ac";
const GREEN = "#26a17b";
const AMBER = "#b58a2a";
const RED = "#c0483f";

function mono(size: number, weight = 400): string {
  return `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace`;
}

/**
 * Draw the receipt onto an offscreen canvas and return it.
 * Layout mirrors the SpendReceipt DOM component.
 */
export function renderReceiptCanvas(data: SpendReceiptData): HTMLCanvasElement {
  const d = receiptDisplay(data);
  const scale = 2;
  const W = 420;
  const PAD = 28;

  const rows: Array<
    | { type: "rule" }
    | { type: "row"; label: string; value: string; big?: boolean }
  > = [
    { type: "rule" },
    { type: "row", label: "YOU SEND", value: d.youSend },
    { type: "row", label: "ORACLE RATE", value: d.rate },
    { type: "row", label: d.feeLabel, value: d.fee },
    { type: "rule" },
    { type: "row", label: "RECIPIENT GETS", value: d.recipientGets, big: true },
    { type: "row", label: "BANK", value: d.bank },
    ...(d.account
      ? [{ type: "row" as const, label: "ACCOUNT NAME", value: d.account }]
      : []),
    { type: "row", label: "TIME TO SETTLE", value: d.settleTime },
    ...(d.reference
      ? [{ type: "row" as const, label: "REFERENCE", value: d.reference }]
      : []),
    { type: "rule" },
  ];

  const headerH = 78;
  const rowH = 30;
  const bigRowH = 40;
  const ruleH = 22;
  const barcodeH = 64;
  const footerH = 46;

  let bodyH = 0;
  for (const r of rows) {
    bodyH += r.type === "rule" ? ruleH : r.big ? bigRowH : rowH;
  }
  const H = PAD + headerH + bodyH + barcodeH + footerH + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Dark backdrop + paper card with scalloped bottom edge
  ctx.fillStyle = "#0a0d14";
  ctx.fillRect(0, 0, W, H);
  const cardX = 10;
  const cardW = W - 20;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.roundRect(cardX, 10, cardW, H - 30, [14, 14, 0, 0]);
  ctx.fill();
  // Scallops
  const scallopR = 6;
  const scallopStep = 18;
  ctx.fillStyle = "#0a0d14";
  for (let x = cardX + scallopStep / 2; x < cardX + cardW; x += scallopStep) {
    ctx.beginPath();
    ctx.arc(x, H - 20, scallopR, 0, Math.PI * 2);
    ctx.fill();
  }

  const left = cardX + PAD - 10;
  const right = cardX + cardW - PAD + 10;
  let y = 10 + PAD + 8;

  // Header
  ctx.fillStyle = INK;
  ctx.font = mono(17, 700);
  ctx.textBaseline = "alphabetic";
  ctx.fillText("JAHPAY", left, y + 6);

  const toneColor =
    d.statusTone === "green" ? GREEN : d.statusTone === "red" ? RED : AMBER;
  ctx.font = mono(11, 700);
  const stW = ctx.measureText(d.statusLabel).width;
  ctx.fillStyle = toneColor;
  ctx.fillText(d.statusLabel, right - stW, y + 4);
  ctx.beginPath();
  ctx.arc(right - stW - 12, y, 3.5, 0, Math.PI * 2);
  ctx.fill();

  y += 26;
  ctx.fillStyle = MUTED;
  ctx.font = mono(10, 500);
  ctx.fillText(d.subtitle, left, y);
  y += headerH - 26 - 8;

  const drawRule = () => {
    ctx.strokeStyle = RULE;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(left, y + ruleH / 2);
    ctx.lineTo(right, y + ruleH / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    y += ruleH;
  };

  for (const r of rows) {
    if (r.type === "rule") {
      drawRule();
      continue;
    }
    const h = r.big ? bigRowH : rowH;
    const baseline = y + h / 2 + 4;
    ctx.fillStyle = r.big ? INK : MUTED;
    ctx.font = mono(r.big ? 12 : 11, r.big ? 700 : 500);
    ctx.fillText(r.label, left, baseline);
    ctx.fillStyle = INK;
    ctx.font = mono(r.big ? 20 : 13, r.big ? 700 : 600);
    const vw = ctx.measureText(r.value).width;
    ctx.fillText(r.value, right - vw, baseline + (r.big ? 2 : 0));
    y += h;
  }

  // Barcode
  const bars = barcodePattern(data.txHash || data.spendId);
  const totalUnits = bars.reduce((a, b) => a + b + 1, 0);
  const unit = (right - left) / totalUnits;
  let bx = left;
  ctx.fillStyle = INK;
  for (const b of bars) {
    ctx.fillRect(bx, y + 10, Math.max(unit * b - 1, 1), barcodeH - 24);
    bx += unit * (b + 1);
  }
  y += barcodeH;

  // Footer
  ctx.fillStyle = MUTED;
  ctx.font = mono(10, 500);
  if (d.txShort) ctx.fillText(`TX ${d.txShort}`, left, y + 8);
  const dateW = ctx.measureText(d.dateLabel).width;
  ctx.fillText(d.dateLabel, right - dateW, y + 8);

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))),
      "image/png",
    );
  });
}

function receiptFileName(data: SpendReceiptData): string {
  return `jahpay-receipt-${data.spendId.slice(0, 10)}.png`;
}

export function receiptShareUrl(spendId: string): string {
  if (typeof window === "undefined") return `/receipt/${spendId}`;
  return `${window.location.origin}/receipt/${encodeURIComponent(spendId)}`;
}

export async function downloadReceiptPng(data: SpendReceiptData): Promise<void> {
  const blob = await canvasToBlob(renderReceiptCanvas(data));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = receiptFileName(data);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ShareOutcome = "shared" | "copied";

/**
 * Share the receipt: native share sheet with the PNG when supported,
 * falling back to a text share, then to copying the receipt link.
 */
export async function shareReceipt(
  data: SpendReceiptData,
): Promise<ShareOutcome> {
  const d = receiptDisplay(data);
  const url = receiptShareUrl(data.spendId);
  const text = `Jahpay settlement receipt — sent ${d.youSend}, recipient got ${d.recipientGets} (${d.bank}).`;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const blob = await canvasToBlob(renderReceiptCanvas(data));
      const file = new File([blob], receiptFileName(data), {
        type: "image/png",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Jahpay Receipt", text });
        return "shared";
      }
      await navigator.share({ title: "Jahpay Receipt", text, url });
      return "shared";
    } catch (err) {
      // User cancelled the share sheet — treat as done, don't fall through
      if ((err as DOMException)?.name === "AbortError") return "shared";
    }
  }

  await navigator.clipboard.writeText(`${text}\n${url}`);
  return "copied";
}
