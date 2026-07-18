"use client";

const SUPPORT_API_URL =
  process.env.NEXT_PUBLIC_SPEND_API_URL || "http://localhost:3001/api/v1";

export type SupportTicketCategory =
  | "transaction"
  | "payment"
  | "account"
  | "technical"
  | "other";

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

export interface CreateSupportTicketRequest {
  userAddress?: string;
  email?: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  spendId?: string;
}

export interface SupportTicket {
  ticketRef: string;
  status: SupportTicketStatus;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  spendId?: string;
  createdAt: string;
  updatedAt: string;
}

async function supportFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPPORT_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new Error(message || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function createSupportTicket(
  params: CreateSupportTicketRequest,
): Promise<SupportTicket> {
  const res = await supportFetch<{ success: boolean; data: SupportTicket }>(
    "/support/tickets",
    {
      method: "POST",
      body: JSON.stringify(params),
    },
  );
  return res.data;
}

export async function fetchSupportTickets(
  userAddress: string,
  page = 1,
  limit = 20,
): Promise<{ tickets: SupportTicket[]; total: number }> {
  const params = new URLSearchParams({
    userAddress,
    page: String(page),
    limit: String(limit),
  });
  return supportFetch(`/support/tickets?${params}`);
}

export async function fetchSupportTicket(
  ticketRef: string,
): Promise<SupportTicket> {
  return supportFetch(`/support/tickets/${encodeURIComponent(ticketRef)}`);
}
