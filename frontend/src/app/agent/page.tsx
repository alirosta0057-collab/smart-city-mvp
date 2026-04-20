"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, Ticket, User } from "@/lib/api";
import { useAuth, useRequireAuth } from "@/lib/auth";

export default function AgentHome() {
  const { user, ready } = useRequireAuth("agent");
  const { refresh } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [online, setOnline] = useState<boolean>(user?.is_online ?? false);

  const load = useCallback(async () => {
    const data = await api.get<Ticket[]>("/api/tickets");
    setTickets(data);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setOnline(user?.is_online ?? false);
    void load();
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, [ready, user, load]);

  async function toggleOnline() {
    const next = !online;
    const updated = await api.patch<User>("/api/users/me/status", {
      is_online: next,
    });
    setOnline(updated.is_online);
    await refresh();
  }

  async function claim(ticketId: number) {
    await api.post(`/api/tickets/${ticketId}/claim`);
    await load();
  }

  if (!ready || !user) return null;

  const queued = tickets.filter((t) => t.status === "queued");
  const mine = tickets.filter(
    (t) => t.agent?.id === user.id && t.status === "in_progress"
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Agent console</h1>
          <p className="text-sm text-slate-500">
            {mine.length} active chat{mine.length === 1 ? "" : "s"} ·{" "}
            {queued.length} queued
          </p>
        </div>
        <button
          onClick={toggleOnline}
          className={`rounded px-4 py-2 text-sm text-white ${
            online ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-500"
          }`}
        >
          {online ? "● Online — accepting tickets" : "○ Offline"}
        </button>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">In queue</h2>
        <ul className="space-y-2">
          {queued.length === 0 && (
            <p className="text-sm text-slate-500">Queue is empty.</p>
          )}
          {queued.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-lg border bg-white p-4"
            >
              <div>
                <div className="font-medium">
                  #{t.id} · {t.subject}{" "}
                  {t.priority === "sos" && (
                    <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                      SOS
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  from {t.citizen.full_name} ·{" "}
                  {new Date(t.created_at).toLocaleTimeString()}
                </div>
              </div>
              <button
                onClick={() => claim(t.id)}
                className="rounded bg-brand-600 px-4 py-1.5 text-sm text-white hover:bg-brand-700"
              >
                Claim
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Active chats</h2>
        <ul className="space-y-2">
          {mine.length === 0 && (
            <p className="text-sm text-slate-500">
              You are not handling any tickets.
            </p>
          )}
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
                  with {t.citizen.full_name}
                </div>
              </div>
              <Link
                href={`/agent/tickets/${t.id}`}
                className="rounded border px-3 py-1 text-sm hover:bg-slate-100"
              >
                Open chat
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
