"use client";

import { useParams } from "next/navigation";
import { ChatRoom } from "@/components/ChatRoom";
import { useRequireAuth } from "@/lib/auth";

export default function AdminChatPage() {
  const { ready } = useRequireAuth("admin");
  const params = useParams<{ id: string }>();
  const ticketId = Number(params?.id);

  if (!ready || !ticketId) return null;
  return (
    <div className="mx-auto max-w-3xl">
      <ChatRoom ticketId={ticketId} selfKind="admin" canSend={false} />
    </div>
  );
}
