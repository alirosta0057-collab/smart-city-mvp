"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Ticket } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

export default function CitizenTicketsPage() {
  const { ready } = useRequireAuth("citizen");
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    if (!ready) return;
    api.get<Ticket[]>("/api/tickets").then(setTickets);
  }, [ready]);

  if (!ready) return null;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">My tickets</h1>
      <ul className="space-y-2">
        {tickets.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between rounded-lg border bg-white p-4"
          >
            <div>
              <Link
                href={`/citizen/tickets/chat?id=${t.id}`}
                className="font-medium text-brand-700"
              >
                #{t.id} · {t.subject}
              </Link>
              <div className="text-xs text-slate-500">
                {new Date(t.created_at).toLocaleString()} ·{" "}
                {t.category?.name ?? "General"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {t.priority === "sos" && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                  SOS
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase">
                {t.status.replace("_", " ")}
              </span>
            </div>
          </li>
        ))}
        {tickets.length === 0 && (
          <p className="text-sm text-slate-500">
            No tickets yet. Open one from the Services page.
          </p>
        )}
      </ul>
    </div>
  );
}
