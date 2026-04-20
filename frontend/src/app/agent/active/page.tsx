"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Ticket } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

export default function AgentActivePage() {
  const { user, ready } = useRequireAuth("agent");
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    if (!ready) return;
    api.get<Ticket[]>("/api/tickets").then(setTickets);
  }, [ready]);

  if (!ready || !user) return null;

  const mine = tickets.filter((t) => t.agent?.id === user.id);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">My tickets</h1>
      <ul className="space-y-2">
        {mine.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between rounded-lg border bg-white p-4"
          >
            <div>
              <Link
                href={`/agent/tickets/${t.id}`}
                className="font-medium text-brand-700"
              >
                #{t.id} · {t.subject}
              </Link>
              <div className="text-xs text-slate-500">
                {t.citizen.full_name} ·{" "}
                {new Date(t.created_at).toLocaleString()}
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase">
              {t.status.replace("_", " ")}
            </span>
          </li>
        ))}
        {mine.length === 0 && (
          <p className="text-sm text-slate-500">No tickets assigned yet.</p>
        )}
      </ul>
    </div>
  );
}
