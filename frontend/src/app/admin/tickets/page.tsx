"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Ticket } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

export default function AdminTicketsPage() {
  const { ready } = useRequireAuth("admin");
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    if (!ready) return;
    api.get<Ticket[]>("/api/tickets").then(setTickets);
  }, [ready]);

  if (!ready) return null;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Tickets</h1>
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Subject</th>
              <th className="px-3 py-2 text-left">Citizen</th>
              <th className="px-3 py-2 text-left">Agent</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Priority</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/tickets/chat?id=${t.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    #{t.id}
                  </Link>
                </td>
                <td className="px-3 py-2">{t.subject}</td>
                <td className="px-3 py-2 text-xs">{t.citizen.full_name}</td>
                <td className="px-3 py-2 text-xs">
                  {t.agent?.full_name ?? "—"}
                </td>
                <td className="px-3 py-2 uppercase text-xs">
                  {t.status.replace("_", " ")}
                </td>
                <td className="px-3 py-2 uppercase text-xs">{t.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
