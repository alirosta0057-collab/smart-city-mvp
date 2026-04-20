"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, Category } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

export default function AdminCategoriesPage() {
  const { ready } = useRequireAuth("admin");
  const [categories, setCategories] = useState<Category[]>([]);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const rows = await api.get<Category[]>("/api/categories");
    setCategories(rows);
  }

  useEffect(() => {
    if (ready) void load();
  }, [ready]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/categories", {
        slug,
        name,
        icon: icon || null,
        description: description || null,
      });
      setSlug("");
      setName("");
      setIcon("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm("Delete category?")) return;
    await api.del(`/api/categories/${id}`);
    await load();
  }

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Categories</h1>
      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-5"
      >
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Icon (emoji)"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2 text-sm sm:col-span-1"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button className="rounded bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700">
          Add
        </button>
        {error && (
          <p className="text-sm text-red-600 sm:col-span-5">{error}</p>
        )}
      </form>

      <ul className="space-y-2">
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm"
          >
            <div>
              <span className="mr-2 text-lg">{c.icon}</span>
              <span className="font-medium">{c.name}</span>
              <span className="ml-2 text-xs text-slate-500">{c.slug}</span>
            </div>
            <button
              onClick={() => onDelete(c.id)}
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
