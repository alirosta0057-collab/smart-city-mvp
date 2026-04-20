"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Loader2,
  Send,
  ShieldAlert,
  UserIcon,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { api, ChatMessage, Ticket, wsUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn, initials, relativeTime } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SenderKind = ChatMessage["sender_kind"];

function SenderAvatar({ kind, name }: { kind: SenderKind; name: string }) {
  if (kind === "bot") {
    return (
      <Avatar className="h-8 w-8 shadow-sm ring-2 ring-background">
        <AvatarFallback className="bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
    );
  }
  if (kind === "system") {
    return (
      <Avatar className="h-8 w-8 shadow-sm ring-2 ring-background">
        <AvatarFallback className="bg-warning/20 text-warning">
          <ShieldAlert className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
    );
  }
  if (kind === "agent") {
    return (
      <Avatar className="h-8 w-8 shadow-sm ring-2 ring-background">
        <AvatarFallback className="bg-success/20 text-success">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
    );
  }
  return (
    <Avatar className="h-8 w-8 shadow-sm ring-2 ring-background">
      <AvatarFallback className="bg-secondary text-secondary-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function statusBadge(status: string) {
  switch (status) {
    case "open":
      return <Badge variant="secondary">Open</Badge>;
    case "queued":
      return <Badge variant="warning">Queued</Badge>;
    case "in_progress":
      return <Badge variant="success">In progress</Badge>;
    case "resolved":
      return <Badge variant="success">Resolved</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

const CANNED = [
  "Hello! I'm on it — one moment.",
  "Could you confirm your exact location?",
  "I'm escalating to the correct team now.",
  "I've resolved this and am closing the ticket. Let me know if you need more help.",
];

export function ChatRoom({
  ticketId,
  selfKind,
  onStatusChange,
  canSend = true,
  showQuickReplies = false,
}: {
  ticketId: number;
  selfKind: "citizen" | "agent" | "admin";
  onStatusChange?: (status: string) => void;
  canSend?: boolean;
  showQuickReplies?: boolean;
}) {
  const { locale, t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [wsReady, setWsReady] = useState<"connecting" | "open" | "closed">(
    "connecting",
  );
  const [now, setNow] = useState<Date>(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<Ticket>(`/api/tickets/${ticketId}`),
      api.get<ChatMessage[]>(`/api/tickets/${ticketId}/messages`),
    ]).then(([tk, msgs]) => {
      if (cancelled) return;
      setTicket(tk);
      setMessages(msgs);
    });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl(`/ws/tickets/${ticketId}`));
    setWsReady("connecting");
    ws.onopen = () => setWsReady("open");
    ws.onclose = () => setWsReady("closed");
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "message") {
          setMessages((prev) =>
            prev.some((m) => m.id === data.message.id)
              ? prev
              : [...prev, data.message],
          );
        }
        if (data.ticket_status) {
          setTicket((tk) =>
            tk ? { ...tk, status: data.ticket_status } : tk,
          );
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

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await api.post(`/api/tickets/${ticketId}/messages`, { body: text });
      setBody("");
    } finally {
      setSending(false);
    }
  }

  const closed =
    ticket?.status === "resolved" || ticket?.status === "cancelled";

  const headerSubtitle = useMemo(() => {
    if (!ticket) return "";
    if (ticket.agent) return `${ticket.agent.full_name} · human agent`;
    if (selfKind === "citizen") return "City Bot · powered by AI";
    return "Bot / queue";
  }, [ticket, selfKind]);

  return (
    <div className="flex h-[78vh] flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b bg-card/80 px-4 py-3 backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">
                #{ticket?.id ?? ticketId} · {ticket?.subject ?? "Chat"}
              </h2>
              {ticket ? statusBadge(ticket.status) : null}
              {ticket?.priority === "sos" ? (
                <Badge variant="destructive" className="gap-1">
                  <ShieldAlert className="h-3 w-3" /> SOS
                </Badge>
              ) : null}
              {ticket?.category ? (
                <Badge variant="outline">
                  {ticket.category.icon ?? "🏷️"} {ticket.category.name}
                </Badge>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">
              {headerSubtitle}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {wsReady === "open" ? (
            <>
              <Wifi className="h-3 w-3 text-success" /> Live
            </>
          ) : wsReady === "connecting" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Connecting…
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-destructive" /> Offline
            </>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto bg-muted/30 px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
            <Bot className="mb-2 h-8 w-8 opacity-60" />
            {locale === "fa" ? "در حال اتصال به دستیار…" : "Connecting you to the assistant…"}
          </div>
        ) : null}
        {messages.map((m, idx) => {
          const self = m.sender_kind === selfKind;
          if (m.sender_kind === "system") {
            return (
              <div
                key={m.id}
                className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-full bg-warning/10 px-4 py-1.5 text-xs text-warning"
              >
                <ShieldAlert className="h-3 w-3" /> {m.body}
              </div>
            );
          }
          const showHeader =
            idx === 0 || messages[idx - 1]?.sender_kind !== m.sender_kind;
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-end gap-2",
                self ? "flex-row-reverse" : "",
              )}
            >
              {showHeader ? (
                <SenderAvatar kind={m.sender_kind} name={m.sender_name} />
              ) : (
                <div className="w-8 flex-none" />
              )}
              <div
                className={cn(
                  "relative max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                  self
                    ? "chat-bubble-self bg-primary text-primary-foreground"
                    : m.sender_kind === "bot"
                      ? "chat-bubble-other bg-card"
                      : "chat-bubble-other bg-card",
                )}
              >
                {showHeader ? (
                  <div
                    className={cn(
                      "mb-1 flex items-center gap-1.5 text-[11px] font-medium",
                      self ? "opacity-80" : "text-muted-foreground",
                    )}
                  >
                    {m.sender_kind === "bot" ? (
                      <Bot className="h-3 w-3" />
                    ) : m.sender_kind === "agent" ? (
                      <Zap className="h-3 w-3" />
                    ) : (
                      <UserIcon className="h-3 w-3" />
                    )}
                    <span>{m.sender_name}</span>
                  </div>
                ) : null}
                <div className="whitespace-pre-wrap leading-relaxed">
                  {m.body}
                </div>
                <div
                  className={cn(
                    "mt-1 text-[10px]",
                    self ? "opacity-70" : "text-muted-foreground",
                  )}
                >
                  {relativeTime(m.created_at, now)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {closed ? (
        <div className="flex items-center justify-center gap-2 border-t bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          {locale === "fa"
            ? `این تیکت ${ticket?.status === "resolved" ? "حل شده" : "لغو شده"} است.`
            : `This ticket is ${ticket?.status}.`}
        </div>
      ) : canSend ? (
        <form onSubmit={send} className="space-y-2 border-t bg-card p-3">
          {showQuickReplies ? (
            <div className="flex flex-wrap gap-2">
              {CANNED.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => setBody(text)}
                  className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:bg-accent hover:text-accent-foreground"
                >
                  {text}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                selfKind === "citizen"
                  ? locale === "fa"
                    ? "پیام خود را بنویسید… (برای اتصال به ایجنت انسانی «escalate» را بنویسید)"
                    : "Type a message… (say 'escalate' to reach a human)"
                  : locale === "fa"
                    ? "پاسخ شما به شهروند…"
                    : "Reply to citizen…"
              }
              className="flex-1"
            />
            <Button
              type="submit"
              variant="brand"
              disabled={sending || !body.trim()}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{t("common.send")}</span>
            </Button>
          </div>
        </form>
      ) : (
        <div className="border-t bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
          {locale === "fa" ? "فقط خواندن" : "Read-only view"}
        </div>
      )}
    </div>
  );
}
