"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  MessageSquare,
  Users,
} from "lucide-react";
import { api, Ticket } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { relativeTime } from "@/lib/utils";

type Filter = "active" | "resolved" | "all";

export default function AgentActivePage() {
  const { user } = useAuth();
  const { ready } = useRequireAuth("agent");
  const { t, locale } = useI18n();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    if (!ready) return;
    const load = () => api.get<Ticket[]>("/api/tickets").then(setTickets);
    void load();
    const id = window.setInterval(load, 10_000);
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, [ready]);

  const mine = useMemo(() => {
    if (!user || tickets === null) return [];
    return tickets.filter((tk) => tk.agent?.id === user.id);
  }, [user, tickets]);

  const filtered = useMemo(() => {
    return mine.filter((tk) => {
      if (filter === "active" && tk.status !== "in_progress") return false;
      if (filter === "resolved" && tk.status !== "resolved") return false;
      return true;
    });
  }, [mine, filter]);

  if (!ready || !user) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {locale === "fa" ? "تیکت‌های من" : "My tickets"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {locale === "fa"
            ? "پرونده‌های فعال و حل‌شدهٔ شما."
            : "Your active and resolved cases."}
        </p>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as Filter)}
      >
        <TabsList>
          <TabsTrigger value="active">
            <Users className="h-3.5 w-3.5" />
            {locale === "fa" ? "فعال" : "Active"}
          </TabsTrigger>
          <TabsTrigger value="resolved">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {locale === "fa" ? "حل شده" : "Resolved"}
          </TabsTrigger>
          <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tickets === null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title={
            filter === "active"
              ? t("agent.active_empty")
              : locale === "fa"
                ? "موردی برای نمایش نیست"
                : "Nothing to show"
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((tk) => (
            <Card key={tk.id} className="transition-shadow hover:shadow-lg">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">
                    <Link
                      href={`/agent/tickets/chat?id=${tk.id}`}
                      className="hover:underline"
                    >
                      #{tk.id} · {tk.subject}
                    </Link>
                  </CardTitle>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {tk.citizen.full_name} ·{" "}
                    {relativeTime(tk.updated_at, now)}
                  </div>
                </div>
                {tk.priority === "sos" ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> SOS
                  </Badge>
                ) : tk.status === "resolved" ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />{" "}
                    {locale === "fa" ? "حل شده" : "Resolved"}
                  </Badge>
                ) : tk.status === "in_progress" ? (
                  <Badge variant="success" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {locale === "fa" ? "فعال" : "Active"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{tk.status}</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {tk.description}
                </p>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/agent/tickets/chat?id=${tk.id}`}>
                    <MessageSquare className="h-4 w-4" />{" "}
                    {t("citizen.open_chat")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
