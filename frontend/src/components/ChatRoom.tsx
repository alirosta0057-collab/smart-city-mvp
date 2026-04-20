"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api, ChatMessage, Ticket, wsUrl } from "@/lib/api";

const SENDER_STYLES: Record<ChatMessage["sender_kind"], string> = {
  citizen: "bg-brand-50 text-slate-900 border-brand-100",
  bot: "bg-slate-100 text-slate-900 border-slate-200",
  agent: "bg-emerald-50 text-emerald-900 border-emerald-200",
  system: "bg-amber-50 text-amber-900 border-amber-200 italic",
};

export function ChatRoom({
  ticketId,
  selfKind,
  onStatusChange,
  canSend = true,
}: {
  ticketId: number;
  selfKind: "citizen" | "agent" | "admin";
  onStatusChange?: (status: string) => void;
  canSend?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<Ticket>(`/api/tickets/${ticketId}`),
      api.get<ChatMessage[]>(`/api/tickets/${ticketId}/messages`),
    ]).then(([t, msgs]) => {
      if (cancelled) return;
      setTicket(t);
      setMessages(msgs);
    });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl(`/ws/tickets/${ticketId}`));
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "message") {
          setMessages((prev) =>
            prev.some((m) => m.id === data.message.id)
              ? prev
              : [...prev, data.message]
          );
        }
        if (data.ticket_status) {
          setTicket((t) => (t ? { ...t, status: data.ticket_status } : t));
          onStatusChange?.(data.ticket_status);
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      ws.close();
    };
  }, [ticketId, onStatusChange]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/api/tickets/${ticketId}/messages`, { body });
      setBody("");
    } finally {
      setSending(false);
    }
  }

  const closed =
    ticket?.status === "resolved" || ticket?.status === "cancelled";

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2 text-sm">
        <div>
          <span className="font-medium">{ticket?.subject ?? "Chat"}</span>
          {ticket && (
            <span className="ml-3 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs uppercase">
              {ticket.status.replace("_", " ")}
            </span>
          )}
          {ticket?.priority === "sos" && (
            <span className="ml-2 inline-block rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
              SOS
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {ticket?.agent ? `Agent: ${ticket.agent.full_name}` : "Bot / queue"}
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-xl rounded-lg border px-3 py-2 text-sm ${
              SENDER_STYLES[m.sender_kind]
            } ${m.sender_kind === selfKind ? "ml-auto" : ""}`}
          >
            <div className="mb-0.5 text-xs font-medium opacity-70">
              {m.sender_name}
              <span className="ml-2 text-[10px] opacity-60">
                {new Date(m.created_at).toLocaleTimeString()}
              </span>
            </div>
            <div className="whitespace-pre-wrap">{m.body}</div>
          </div>
        ))}
      </div>
      {canSend && !closed && (
        <form onSubmit={send} className="flex gap-2 border-t p-3">
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message… (say 'escalate' to reach a human)"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Send
          </button>
        </form>
      )}
      {closed && (
        <div className="border-t bg-slate-50 p-3 text-center text-sm text-slate-500">
          This ticket is {ticket?.status}.
        </div>
      )}
    </div>
  );
}
