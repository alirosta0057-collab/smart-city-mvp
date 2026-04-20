"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChatRoom } from "@/components/ChatRoom";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";

function Inner() {
  const { ready } = useRequireAuth("agent");
  const params = useSearchParams();
  const router = useRouter();
  const ticketId = Number(params?.get("id") ?? "");
  const [resolving, setResolving] = useState(false);

  async function resolve() {
    setResolving(true);
    try {
      await api.post(`/api/tickets/${ticketId}/resolve`);
      router.push("/agent");
    } finally {
      setResolving(false);
    }
  }

  if (!ready || !ticketId) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex justify-end">
        <button
          onClick={resolve}
          disabled={resolving}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {resolving ? "…" : "Mark resolved"}
        </button>
      </div>
      <ChatRoom ticketId={ticketId} selfKind="agent" />
    </div>
  );
}

export default function AgentChatPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
