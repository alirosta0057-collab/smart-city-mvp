"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, homeForRole } from "@/lib/auth";
import { ApiError, type UserRole } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("citizen");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const u = await register(email, password, fullName, role);
      router.replace(homeForRole(u.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Full name</span>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>
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
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="citizen">Citizen</option>
            <option value="agent">Agent (human support)</option>
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-brand-600 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="text-brand-700" href="/login">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
