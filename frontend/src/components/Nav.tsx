"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function Nav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const links =
    user?.role === "admin"
      ? [
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/users", label: "Users" },
          { href: "/admin/categories", label: "Categories" },
          { href: "/admin/businesses", label: "Businesses" },
          { href: "/admin/tickets", label: "Tickets" },
        ]
      : user?.role === "agent"
      ? [
          { href: "/agent", label: "Queue" },
          { href: "/agent/active", label: "My Tickets" },
        ]
      : user?.role === "citizen"
      ? [
          { href: "/citizen", label: "Services" },
          { href: "/citizen/tickets", label: "My Tickets" },
        ]
      : [];

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-brand-700">
          Smart City
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-slate-700 hover:text-brand-700"
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <span className="text-xs text-slate-500">
                {user.full_name} · {user.role}
              </span>
              <button
                className="rounded border px-3 py-1 text-sm hover:bg-slate-100"
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-brand-700">
                Login
              </Link>
              <Link
                href="/register"
                className="rounded bg-brand-600 px-3 py-1 text-white hover:bg-brand-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
