"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatRoom } from "@/components/ChatRoom";
import { useRequireAuth } from "@/lib/auth";

function Inner() {
  const { ready } = useRequireAuth("citizen");
  const params = useSearchParams();
  const ticketId = Number(params?.get("id") ?? "");

  if (!ready || !ticketId) return null;
  return (
    <div className="mx-auto max-w-3xl">
      <ChatRoom ticketId={ticketId} selfKind="citizen" />
    </div>
  );
}

export default function CitizenChatPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
