"use client";

import { Fragment, useState } from "react";
import { useQuery, keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AddressChip,
  Callout,
  EmptyRow,
  fetchAdmin,
  LoadingBlock,
  SectionCard,
  StatusPill,
  TableShell,
} from "@/components/admin/ui";

const PAGE_SIZE = 25;
const STATUS_FILTERS = ["all", "open", "in_progress", "resolved", "closed"];
const NEXT_STATUS: Record<string, { label: string; status: string }> = {
  open: { label: "Start", status: "in_progress" },
  in_progress: { label: "Resolve", status: "resolved" },
  resolved: { label: "Close", status: "closed" },
  closed: { label: "Reopen", status: "open" },
};

interface Ticket {
  ticketRef: string;
  status: string;
  category: string;
  subject: string;
  message: string;
  spendId?: string;
  userAddress?: string;
  email?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketResponse {
  configured: boolean;
  tickets: Ticket[];
  total: number;
  openCount: number;
  error?: string;
}

export default function AdminTicketsPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    page: String(page + 1),
  });
  if (status !== "all") params.set("status", status);
  if (submittedSearch) params.set("search", submittedSearch);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-tickets", status, submittedSearch, page],
    queryFn: () => fetchAdmin<TicketResponse>(`/api/admin/tickets?${params}`),
    placeholderData: keepPreviousData,
  });

  const updateStatus = useMutation({
    mutationFn: async (vars: { ticketRef: string; status: string }) => {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });

  const totalPages = data ? Math.max(Math.ceil(data.total / PAGE_SIZE), 1) : 1;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
        <p className="mt-1 text-sm text-white/50">
          Every ticket users submit from the app. Click a row to read the full message and
          advance its status.
          {data?.openCount ? (
            <span className="ml-1 text-amber-400">{data.openCount} open.</span>
          ) : null}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-[#0d111c]/80 p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(0);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs capitalize transition-colors",
                status === s
                  ? "bg-brand-blue/15 font-medium text-brand-blue"
                  : "text-white/55 hover:text-white",
              )}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
        <form
          className="relative ml-auto"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedSearch(search.trim());
            setPage(0);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ref, wallet, email, subject…"
            className="h-9 w-64 rounded-xl border border-white/[0.08] bg-[#0d111c]/80 pl-9 pr-3 font-mono text-xs text-white placeholder:text-white/30 focus:border-brand-blue/50 focus:outline-none"
          />
        </form>
      </div>

      {error && <Callout tone="error">{(error as Error).message}</Callout>}
      {data && !data.configured && (
        <Callout tone="warning">{data.error || "Support server is not reachable."}</Callout>
      )}

      <SectionCard>
        {isLoading && !data ? (
          <LoadingBlock label="Loading tickets…" />
        ) : (
          <TableShell
            head={
              <>
                <th className="pb-2 pr-4 font-semibold">Status</th>
                <th className="pb-2 pr-4 font-semibold">Ref</th>
                <th className="pb-2 pr-4 font-semibold">Category</th>
                <th className="pb-2 pr-4 font-semibold">Subject</th>
                <th className="pb-2 pr-4 font-semibold">From</th>
                <th className="pb-2 pr-4 font-semibold">When</th>
                <th className="pb-2 font-semibold" />
              </>
            }
          >
            {(data?.tickets.length ?? 0) === 0 && (
              <EmptyRow colSpan={7} message="No tickets match these filters." />
            )}
            {data?.tickets.map((t) => {
              const isOpen = expanded === t.ticketRef;
              const next = NEXT_STATUS[t.status];
              return (
                <Fragment key={t.ticketRef}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : t.ticketRef)}
                    className="cursor-pointer text-white/80 hover:bg-white/[0.02]"
                  >
                    <td className="py-2.5 pr-4">
                      <StatusPill status={t.status} />
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-white/70">
                      {t.ticketRef}
                    </td>
                    <td className="py-2.5 pr-4 capitalize">{t.category}</td>
                    <td className="max-w-[22ch] truncate py-2.5 pr-4">{t.subject}</td>
                    <td className="py-2.5 pr-4">
                      {t.userAddress ? (
                        <AddressChip address={t.userAddress} />
                      ) : (
                        <span className="text-xs text-white/50">{t.email || "—"}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-white/50">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right">
                      {next && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus.mutate({ ticketRef: t.ticketRef, status: next.status });
                          }}
                          disabled={updateStatus.isPending}
                          className="btn-quiet h-7 px-2.5 text-xs disabled:opacity-40"
                        >
                          {next.label}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-white/[0.015]">
                      <td colSpan={7} className="px-4 pb-4 pt-1">
                        <div className="space-y-2 rounded-xl border border-white/[0.06] bg-[#0d111c]/60 p-4">
                          <p className="text-sm font-medium text-white">{t.subject}</p>
                          <p className="whitespace-pre-wrap text-sm text-white/70">
                            {t.message}
                          </p>
                          <div className="flex flex-wrap gap-x-6 gap-y-1 pt-2 text-xs text-white/45">
                            {t.email && <span>Email: {t.email}</span>}
                            {t.spendId && <span>Spend: {t.spendId}</span>}
                            <span>Updated: {new Date(t.updatedAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </TableShell>
        )}

        {data && data.total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-white/50">
            <span className="font-mono tabular-nums">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} of{" "}
              {data.total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
                className="btn-quiet h-8 px-3 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                disabled={page >= totalPages - 1}
                className="btn-quiet h-8 px-3 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
