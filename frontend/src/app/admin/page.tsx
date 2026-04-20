"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

interface Stats {
  users: {
    total: number;
    citizens: number;
    agents: number;
    agents_online: number;
  };
  directory: { categories: number; businesses: number };
  tickets: Record<string, number>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { ready } = useRequireAuth("admin");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!ready) return;
    api.get<Stats>("/api/admin/stats").then(setStats);
  }, [ready]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>
      {stats ? (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-600">Users</h2>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Total" value={stats.users.total} />
              <Stat label="Citizens" value={stats.users.citizens} />
              <Stat label="Agents" value={stats.users.agents} />
              <Stat
                label="Agents online"
                value={stats.users.agents_online}
              />
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-600">
              Directory
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Categories" value={stats.directory.categories} />
              <Stat label="Businesses" value={stats.directory.businesses} />
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-600">
              Tickets
            </h2>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Total" value={stats.tickets.total ?? 0} />
              {["open", "queued", "in_progress", "resolved", "cancelled"].map(
                (s) => (
                  <Stat
                    key={s}
                    label={s.replace("_", " ")}
                    value={stats.tickets[s] ?? 0}
                  />
                )
              )}
            </div>
          </section>
          <section className="flex gap-3 text-sm">
            <Link
              href="/admin/users"
              className="rounded border px-3 py-1.5 hover:bg-slate-100"
            >
              Manage users
            </Link>
            <Link
              href="/admin/categories"
              className="rounded border px-3 py-1.5 hover:bg-slate-100"
            >
              Manage categories
            </Link>
            <Link
              href="/admin/businesses"
              className="rounded border px-3 py-1.5 hover:bg-slate-100"
            >
              Manage businesses
            </Link>
            <Link
              href="/admin/tickets"
              className="rounded border px-3 py-1.5 hover:bg-slate-100"
            >
              Browse tickets
            </Link>
          </section>
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading…</p>
      )}
    </div>
  );
}
