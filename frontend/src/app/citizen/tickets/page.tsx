"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Plus,
  Ticket as TicketIcon,
  Users,
} from "lucide-react";
import { api, Ticket } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Badge, BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, relativeTime } from "@/lib/utils";

type Filter = "all" | "open" | "in_progress" | "resolved";

function statusMeta(status: string): {
  variant: BadgeVariant;
  icon: React.ReactNode;
  label: string;
} {
  switch (status) {
    case "queued":
      return {
        variant: "warning",
        icon: <Clock className="h-3 w-3" />,
        label: "Queued",
      };
    case "in_progress":
      return {
        variant: "success",
        icon: <Users className="h-3 w-3" />,
        label: "In progress",
      };
    case "resolved":
      return {
        variant: "success",
        icon: <CheckCircle2 className="h-3 w-3" />,
        label: "Resolved",
      };
    case "cancelled":
      return {
        variant: "destructive",
        icon: <AlertTriangle className="h-3 w-3" />,
        label: "Cancelled",
      };
    default:
      return {
        variant: "secondary",
        icon: <MessageSquare className="h-3 w-3" />,
        label: "Open",
      };
  }
}

export default function CitizenTicketsPage() {
  const { ready } = useRequireAuth("citizen");
  const { t, locale } = useI18n();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    if (!ready) return;
    api.get<Ticket[]>("/api/tickets").then(setTickets);
    const id = window.setInterval(
      () => api.get<Ticket[]>("/api/tickets").then(setTickets),
      10_000,
    );
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, [ready]);

  const filtered = useMemo(() => {
    const base = tickets ?? [];
    return base.filter((tk) => {
      if (filter === "open" && tk.status !== "open" && tk.status !== "queued")
        return false;
      if (filter === "in_progress" && tk.status !== "in_progress") return false;
      if (filter === "resolved" && tk.status !== "resolved") return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !tk.subject.toLowerCase().includes(q) &&
          !tk.description.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, filter, query]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("citizen.my_tickets")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("citizen.my_tickets_desc")}
          </p>
        </div>
        <Button variant="brand" asChild>
          <Link href="/citizen">
            <Plus className="h-4 w-4" /> {t("citizen.open_ticket")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          className="flex-1"
        >
          <TabsList>
            <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
            <TabsTrigger value="open">
              {locale === "fa" ? "باز" : "Open"}
            </TabsTrigger>
            <TabsTrigger value="in_progress">
              {locale === "fa" ? "در حال بررسی" : "Active"}
            </TabsTrigger>
            <TabsTrigger value="resolved">
              {locale === "fa" ? "حل شده" : "Resolved"}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder={t("common.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-xs"
        />
      </div>

      {tickets === null ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<TicketIcon className="h-5 w-5" />}
          title={t("citizen.no_tickets")}
          description={
            locale === "fa"
              ? "از صفحهٔ خدمات درخواست جدید ایجاد کنید — ربات فوراً پاسخ می‌دهد."
              : "Open a request from Services — our bot replies instantly."
          }
          action={
            <Button variant="brand" asChild>
              <Link href="/citizen">
                <Plus className="h-4 w-4" /> {t("citizen.create_first")}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((tk) => {
            const meta = statusMeta(tk.status);
            const isSos = tk.priority === "sos";
            return (
              <Card
                key={tk.id}
                className={cn(
                  "group transition-shadow hover:shadow-lg",
                  isSos ? "border-destructive/40" : "",
                )}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      <Link
                        href={`/citizen/tickets/chat?id=${tk.id}`}
                        className="hover:underline"
                      >
                        #{tk.id} · {tk.subject}
                      </Link>
                    </CardTitle>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {tk.category?.icon} {tk.category?.name ?? "General"} ·{" "}
                      {relativeTime(tk.created_at, now)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={meta.variant}
                      className="gap-1 whitespace-nowrap"
                    >
                      {meta.icon}
                      {meta.label}
                    </Badge>
                    {isSos ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> SOS
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {tk.description}
                  </p>
                  {tk.agent ? (
                    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> {tk.agent.full_name}
                    </div>
                  ) : null}
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/citizen/tickets/chat?id=${tk.id}`}>
                      {tk.status === "resolved" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                      {t("citizen.open_chat")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tickets !== null && tickets.length > 0 && filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
          {t("common.noresults")}
        </p>
      ) : null}
    </div>
  );
}
