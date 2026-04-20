"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, homeForRole } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const u = await login(email, password);
      router.replace(homeForRole(u.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">Log in</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-brand-600 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
        <p className="text-center text-sm text-slate-600">
          New here?{" "}
          <Link className="text-brand-700" href="/register">
            Create an account
          </Link>
        </p>
        <div className="rounded bg-slate-50 p-3 text-xs text-slate-600">
          Demo: <code>citizen@smartcity.example</code> / <code>pass123</code>
          <br />
          <code>agent@smartcity.example</code> / <code>pass123</code>
          <br />
          <code>admin@smartcity.example</code> / <code>admin123</code>
        </div>
      </form>
    </div>
  );
}
