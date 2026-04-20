"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Business, Category } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

export default function AdminBusinessesPage() {
  const { ready } = useRequireAuth("admin");
  const [categories, setCategories] = useState<Category[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    lat: "",
    lng: "",
    category_id: "",
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cats, list] = await Promise.all([
      api.get<Category[]>("/api/categories"),
      api.get<Business[]>("/api/businesses"),
    ]);
    setCategories(cats);
    setBusinesses(list);
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/businesses", {
        name: form.name,
        phone: form.phone || null,
        address: form.address || null,
        lat: Number(form.lat),
        lng: Number(form.lng),
        category_id: Number(form.category_id),
      });
      setForm({
        name: "",
        phone: "",
        address: "",
        lat: "",
        lng: "",
        category_id: form.category_id,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm("Delete business?")) return;
    await api.del(`/api/businesses/${id}`);
    await load();
  }

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Businesses</h1>
      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-6"
      >
        <input
          className="rounded border px-3 py-2 text-sm sm:col-span-2"
          placeholder="Name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select
          className="rounded border px-3 py-2 text-sm"
          required
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
        >
          <option value="">Category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Lat"
          type="number"
          step="any"
          required
          value={form.lat}
          onChange={(e) => setForm({ ...form, lat: e.target.value })}
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Lng"
          type="number"
          step="any"
          required
          value={form.lng}
          onChange={(e) => setForm({ ...form, lng: e.target.value })}
        />
        <button className="rounded bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700">
          Add
        </button>
        <input
          className="rounded border px-3 py-2 text-sm sm:col-span-3"
          placeholder="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <input
          className="rounded border px-3 py-2 text-sm sm:col-span-3"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        {error && (
          <p className="text-sm text-red-600 sm:col-span-6">{error}</p>
        )}
      </form>

      <ul className="space-y-2">
        {businesses.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm"
          >
            <div>
              <span className="mr-2">{b.category.icon}</span>
              <span className="font-medium">{b.name}</span>
              <span className="ml-2 text-xs text-slate-500">
                {b.category.name} · {b.address ?? "—"}
              </span>
            </div>
            <button
              onClick={() => onDelete(b.id)}
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
