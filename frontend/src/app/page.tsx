"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, homeForRole } from "@/lib/auth";

export default function Landing() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(homeForRole(user.role));
    }
  }, [loading, user, router]);

  return (
    <section className="mx-auto max-w-3xl py-10 text-center">
      <h1 className="text-4xl font-bold text-slate-900">
        A virtual smart city at your fingertips
      </h1>
      <p className="mt-4 text-lg text-slate-600">
        Find every service near you, open a ticket, and get answers instantly
        from our AI agent — with a human agent a click away if you need one.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          href="/register"
          className="rounded-md bg-brand-600 px-5 py-2.5 text-white hover:bg-brand-700"
        >
          Join your city
        </Link>
        <Link
          href="/login"
          className="rounded-md border px-5 py-2.5 hover:bg-slate-100"
        >
          Log in
        </Link>
      </div>
      <ul className="mt-10 grid gap-4 text-left sm:grid-cols-3">
        <li className="rounded-lg border bg-white p-4">
          <div className="text-2xl">📍</div>
          <div className="font-medium">Location-aware</div>
          <div className="text-sm text-slate-600">
            Nearest agents and businesses matched to your IP and location.
          </div>
        </li>
        <li className="rounded-lg border bg-white p-4">
          <div className="text-2xl">🤖</div>
          <div className="font-medium">AI bot first</div>
          <div className="text-sm text-slate-600">
            Autonomous agent resolves routine requests and escalates only when
            needed.
          </div>
        </li>
        <li className="rounded-lg border bg-white p-4">
          <div className="text-2xl">🚨</div>
          <div className="font-medium">SOS queue</div>
          <div className="text-sm text-slate-600">
            Emergencies go straight to the nearest human agent online.
          </div>
        </li>
      </ul>
    </section>
  );
}
