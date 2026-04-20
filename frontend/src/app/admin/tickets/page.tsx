"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Search,
  Users,
} from "lucide-react";
import { api, Ticket } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { relativeTime } from "@/lib/utils";

type Filter = "all" | "open" | "queued" | "in_progress" | "resolved" | "sos";

export default function AdminTicketsPage() {
  const { ready } = useRequireAuth("admin");
  const { t, locale } = useI18n();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
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

  const filtered = useMemo(() => {
    const base = tickets ?? [];
    return base.filter((tk) => {
      if (filter === "sos" && tk.priority !== "sos") return false;
      if (filter !== "all" && filter !== "sos" && tk.status !== filter)
        return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !tk.subject.toLowerCase().includes(q) &&
          !tk.description.toLowerCase().includes(q) &&
          !tk.citizen.full_name.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, filter, query]);

  if (!ready) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("nav.tickets")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {locale === "fa"
            ? "همهٔ تیکت‌های شهر — قابل جستجو و فیلتر."
            : "Every ticket in the city — searchable and filterable."}
        </p>
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
            <TabsTrigger value="queued">
              {locale === "fa" ? "در صف" : "Queued"}
            </TabsTrigger>
            <TabsTrigger value="in_progress">
              {locale === "fa" ? "فعال" : "Active"}
            </TabsTrigger>
            <TabsTrigger value="resolved">
              {locale === "fa" ? "حل شده" : "Resolved"}
            </TabsTrigger>
            <TabsTrigger value="sos">SOS</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("common.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {tickets === null ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title={t("common.noresults")}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">
                    {t("common.subject")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {locale === "fa" ? "شهروند" : "Citizen"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {locale === "fa" ? "ایجنت" : "Agent"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("common.status")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("common.priority")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {locale === "fa" ? "زمان" : "Updated"}
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((tk) => (
                  <tr key={tk.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                      #{tk.id}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tickets/chat?id=${tk.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {tk.subject}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {tk.category?.icon} {tk.category?.name ?? "General"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {tk.citizen.full_name}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {tk.agent?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          tk.status === "resolved"
                            ? "success"
                            : tk.status === "queued"
                              ? "warning"
                              : tk.status === "cancelled"
                                ? "destructive"
                                : tk.status === "in_progress"
                                  ? "success"
                                  : "secondary"
                        }
                        className="gap-1"
                      >
                        {tk.status === "resolved" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : tk.status === "queued" ? (
                          <Clock className="h-3 w-3" />
                        ) : tk.status === "in_progress" ? (
                          <Users className="h-3 w-3" />
                        ) : null}
                        {tk.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {tk.priority === "sos" ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> SOS
                        </Badge>
                      ) : (
                        <span className="text-xs uppercase text-muted-foreground">
                          {tk.priority}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {relativeTime(tk.updated_at, now)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/tickets/chat?id=${tk.id}`}>
                          {t("common.open")}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
