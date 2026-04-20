"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Business, Category, Ticket } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

export default function CitizenHome() {
  const { user, ready } = useRequireAuth("citizen");
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSlug) params.set("category_slug", selectedSlug);
      if (q) params.set("q", q);
      const data = await api.get<Business[]>(
        `/api/businesses?${params.toString()}`
      );
      setBusinesses(data);
    } finally {
      setLoading(false);
    }
  }, [selectedSlug, q]);

  useEffect(() => {
    if (!ready) return;
    api.get<Category[]>("/api/categories").then(setCategories);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    void loadBusinesses();
  }, [ready, loadBusinesses]);

  async function detectLocation() {
    setLocating(true);
    try {
      await api.post("/api/auth/locate", {});
      await loadBusinesses();
    } finally {
      setLocating(false);
    }
  }

  async function openSOS() {
    const desc = window.prompt(
      "Describe your emergency briefly (optional):",
      ""
    );
    const ticket = await api.post<Ticket>("/api/tickets", {
      subject: "SOS",
      description: desc?.trim() || "SOS — assistance needed",
      priority: "sos",
      lat: user?.lat ?? null,
      lng: user?.lng ?? null,
    });
    router.push(`/citizen/tickets/${ticket.id}`);
  }

  async function openTicket(category: Category) {
    const subject = window.prompt(
      `Subject for a ${category.name} ticket:`,
      `Help with ${category.name}`
    );
    if (!subject) return;
    const description = window.prompt(
      "Describe what you need:",
      ""
    );
    if (!description) return;
    const ticket = await api.post<Ticket>("/api/tickets", {
      subject,
      description,
      priority: "normal",
      category_id: category.id,
      lat: user?.lat ?? null,
      lng: user?.lng ?? null,
    });
    router.push(`/citizen/tickets/${ticket.id}`);
  }

  const locationLabel = useMemo(() => {
    if (!user?.lat) return "Location unknown";
    return `${user.city ?? "—"} · ${user.lat.toFixed(3)}, ${user.lng?.toFixed(
      3
    )}`;
  }, [user]);

  if (!ready || !user) return null;

  return (
    <div className="space-y-8">
      <section className="rounded-lg bg-gradient-to-r from-brand-600 to-brand-900 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              Hello, {user.full_name.split(" ")[0]} 👋
            </h1>
            <p className="mt-1 text-sm text-brand-50/90">{locationLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={detectLocation}
              disabled={locating}
              className="rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
            >
              {locating ? "Locating…" : "Re-detect location"}
            </button>
            <button
              onClick={openSOS}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700"
            >
              🚨 SOS
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Categories</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <button
            onClick={() => setSelectedSlug("")}
            className={`rounded-lg border bg-white p-4 text-left hover:bg-slate-50 ${
              !selectedSlug ? "ring-2 ring-brand-500" : ""
            }`}
          >
            <div className="text-2xl">🌆</div>
            <div className="mt-1 font-medium">All</div>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedSlug(c.slug)}
              className={`rounded-lg border bg-white p-4 text-left hover:bg-slate-50 ${
                selectedSlug === c.slug ? "ring-2 ring-brand-500" : ""
              }`}
              onDoubleClick={() => openTicket(c)}
              title="Double-click to open a ticket"
            >
              <div className="text-2xl">{c.icon ?? "🏷️"}</div>
              <div className="mt-1 font-medium">{c.name}</div>
              <div className="text-xs text-slate-500">{c.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nearby businesses</h2>
          <input
            className="rounded border px-3 py-1.5 text-sm"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : businesses.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing found.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {businesses.map((b) => (
              <li
                key={b.id}
                className="rounded-lg border bg-white p-4 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{b.name}</div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {b.distance_km.toFixed(2)} km
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {b.category.icon} {b.category.name}
                </div>
                {b.address && (
                  <div className="mt-1 text-xs text-slate-600">
                    {b.address}
                  </div>
                )}
                {b.phone && (
                  <div className="mt-0.5 text-xs text-slate-600">
                    📞 {b.phone}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
