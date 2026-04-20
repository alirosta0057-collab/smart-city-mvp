"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Hand,
  Headset,
  Inbox,
  Loader2,
  MapPin,
  MessageSquare,
  Power,
  RefreshCw,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";
import { api, Ticket, User } from "@/lib/api";
import { useAuth, useRequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/toaster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatKm, initials, relativeTime } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function haversineKm(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
    return null;
  }
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default function AgentHome() {
  const { user, refresh } = useAuth();
  const { ready } = useRequireAuth("agent");
  const { t, locale } = useI18n();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [online, setOnline] = useState<boolean>(user?.is_online ?? false);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  const load = useCallback(async () => {
    const data = await api.get<Ticket[]>("/api/tickets");
    setTickets(data);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setOnline(user?.is_online ?? false);
    void load();
    const id = window.setInterval(load, 5000);
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, [ready, user, load]);

  async function toggleOnline(next: boolean) {
    try {
      const updated = await api.patch<User>("/api/users/me/status", {
        is_online: next,
      });
      setOnline(updated.is_online);
      await refresh();
      toast({
        title: updated.is_online
          ? t("agent.status_online")
          : t("agent.status_offline"),
        variant: updated.is_online ? "success" : "default",
      });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  async function claim(ticketId: number) {
    setClaiming(ticketId);
    try {
      await api.post(`/api/tickets/${ticketId}/claim`);
      await load();
      toast({
        title: locale === "fa" ? "تیکت پذیرفته شد" : "Ticket claimed",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setClaiming(null);
    }
  }

  if (!user) return null;

  const queued = (tickets ?? []).filter((tk) => tk.status === "queued");
  const mine = (tickets ?? []).filter(
    (tk) => tk.agent?.id === user.id && tk.status === "in_progress",
  );
  const resolvedToday = (tickets ?? []).filter(
    (tk) =>
      tk.status === "resolved" &&
      tk.agent?.id === user.id &&
      new Date(tk.updated_at).toDateString() === now.toDateString(),
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-background to-success/10">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
              <Headset className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t("agent.console")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {user.full_name} ·{" "}
                {online ? t("agent.status_online") : t("agent.status_offline")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-card/70 px-4 py-2 shadow-sm backdrop-blur">
            <Power
              className={cn(
                "h-4 w-4",
                online ? "text-success" : "text-muted-foreground",
              )}
            />
            <Switch
              checked={online}
              onCheckedChange={toggleOnline}
              aria-label="Toggle online"
            />
            <span className="text-sm font-medium">
              {online ? t("agent.mark_offline") : t("agent.mark_online")}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={<Inbox className="h-4 w-4" />}
          label={t("agent.queue_title")}
          value={queued.length}
          tone="warning"
        />
        <MetricCard
          icon={<MessageSquare className="h-4 w-4" />}
          label={t("agent.active_title")}
          value={mine.length}
          tone="primary"
        />
        <MetricCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label={locale === "fa" ? "حل‌شده امروز" : "Resolved today"}
          value={resolvedToday.length}
          tone="success"
        />
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="queue">
              <Inbox className="h-3.5 w-3.5" />
              {t("agent.queue_title")} ({queued.length})
            </TabsTrigger>
            <TabsTrigger value="mine">
              <MessageSquare className="h-3.5 w-3.5" />
              {t("agent.active_title")} ({mine.length})
            </TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void load();
              toast({
                title: t("common.refresh"),
                variant: "default",
              });
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("common.refresh")}
          </Button>
        </div>

        <TabsContent value="queue" className="space-y-3">
          {tickets === null ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : queued.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title={t("agent.queue_empty")}
              description={
                locale === "fa"
                  ? "فعلاً کسی به ایجنت انسانی نیاز ندارد. به شما اطلاع می‌دهیم."
                  : "No one needs a human right now. We'll notify you when they do."
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {queued.map((tk) => {
                const distance = haversineKm(user, tk);
                return (
                  <QueuedCard
                    key={tk.id}
                    ticket={tk}
                    distanceKm={distance}
                    now={now}
                    claiming={claiming === tk.id}
                    onClaim={() => claim(tk.id)}
                    locale={locale}
                    t={t}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3">
          {mine.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title={t("agent.active_empty")}
              description={
                locale === "fa"
                  ? "برای پذیرش تیکت از صف، به تب «صف» بروید."
                  : "Claim a ticket from the queue to get started."
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {mine.map((tk) => (
                <ActiveCard key={tk.id} ticket={tk} now={now} t={t} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "primary" | "success" | "warning";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
  } as const;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            toneMap[tone],
          )}
        >
          {icon}
        </span>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function QueuedCard({
  ticket,
  distanceKm,
  now,
  claiming,
  onClaim,
  locale,
  t,
}: {
  ticket: Ticket;
  distanceKm: number | null;
  now: Date;
  claiming: boolean;
  onClaim: () => void;
  locale: "en" | "fa";
  t: ReturnType<typeof useI18n>["t"];
}) {
  const isSos = ticket.priority === "sos";
  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow hover:shadow-lg",
        isSos ? "border-destructive/40 shadow-sm ring-1 ring-destructive/20" : "",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback
              className={cn(
                isSos
                  ? "bg-destructive/20 text-destructive"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {initials(ticket.citizen.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-base">
              #{ticket.id} · {ticket.subject}
            </CardTitle>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {ticket.citizen.full_name} · {relativeTime(ticket.created_at, now)}
            </div>
          </div>
        </div>
        {isSos ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> SOS
          </Badge>
        ) : (
          <Badge variant="warning">Queued</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {ticket.description}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {ticket.category ? (
            <span className="inline-flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {ticket.category.icon} {ticket.category.name}
            </span>
          ) : null}
          {distanceKm != null ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {formatKm(distanceKm)}{" "}
              {t("common.km")}
            </span>
          ) : null}
          {isSos ? (
            <span className="inline-flex items-center gap-1 text-destructive">
              <ShieldAlert className="h-3 w-3" /> {t("agent.sos_warning")}
            </span>
          ) : null}
        </div>
        <Button
          variant={isSos ? "destructive" : "brand"}
          className="w-full"
          onClick={onClaim}
          disabled={claiming}
        >
          {claiming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Hand className="h-4 w-4" />
          )}
          {locale === "fa" ? "پذیرش و شروع گفتگو" : t("agent.claim")}
        </Button>
      </CardContent>
    </Card>
  );
}

function ActiveCard({
  ticket,
  now,
  t,
}: {
  ticket: Ticket;
  now: Date;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const isSos = ticket.priority === "sos";
  return (
    <Card className="transition-shadow hover:shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/15 text-primary">
              <Users className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-base">
              #{ticket.id} · {ticket.subject}
            </CardTitle>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {ticket.citizen.full_name} ·{" "}
              {relativeTime(ticket.updated_at, now)}
            </div>
          </div>
        </div>
        {isSos ? (
          <Badge variant="destructive">SOS</Badge>
        ) : (
          <Badge variant="success">In progress</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {ticket.description}
        </p>
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/agent/tickets/chat?id=${ticket.id}`}>
            <MessageSquare className="h-4 w-4" /> {t("citizen.open_chat")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
