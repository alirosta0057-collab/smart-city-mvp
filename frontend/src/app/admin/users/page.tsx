"use client";

import { useEffect, useState } from "react";
import { api, User } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

export default function AdminUsersPage() {
  const { ready } = useRequireAuth("admin");
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!ready) return;
    api.get<User[]>("/api/users").then(setUsers);
  }, [ready]);

  if (!ready) return null;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Users</h1>
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-left">Online</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.full_name}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase">
                    {u.role}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {u.city ?? "—"}
                  {u.lat ? ` · ${u.lat.toFixed(3)}, ${u.lng?.toFixed(3)}` : ""}
                </td>
                <td className="px-3 py-2">
                  {u.role === "agent" ? (u.is_online ? "●" : "○") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
