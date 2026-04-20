"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  ShieldAlert,
  Tag,
  Ticket as TicketIcon,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Stats {
  users: {
    total: number;
    citizens: number;
    agents: number;
    agents_online: number;
  };
  directory: { categories: number; businesses: number };
  tickets: Record<string, number>;
}

interface Analytics {
  daily: { date: string; total: number; sos: number; resolved: number }[];
  by_status: Record<string, number>;
  by_category: { id: number; name: string; icon: string; count: number }[];
  top_agents: {
    id: number;
    name: string;
    is_online: boolean;
    count: number;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  open: "#6366f1",
  queued: "#f59e0b",
  in_progress: "#22c55e",
  resolved: "#10b981",
  cancelled: "#ef4444",
};

export default function AdminDashboard() {
  const { ready } = useRequireAuth("admin");
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    if (!ready) return;
    void api.get<Stats>("/api/admin/stats").then(setStats);
    void api.get<Analytics>("/api/admin/analytics").then(setAnalytics);
    const id = window.setInterval(() => {
      void api.get<Stats>("/api/admin/stats").then(setStats);
      void api.get<Analytics>("/api/admin/analytics").then(setAnalytics);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [ready]);

  if (!ready) return null;

  const statusPieData = analytics
    ? Object.entries(analytics.by_status)
        .filter(([, n]) => n > 0)
        .map(([key, value]) => ({
          name: key.replace("_", " "),
          value,
          key,
        }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("admin.dashboard")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.dashboard_desc")}
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<Users className="h-4 w-4" />}
          label={t("admin.total_users")}
          value={stats?.users.total ?? "—"}
          caption={
            stats
              ? `${stats.users.citizens} ${locale === "fa" ? "شهروند" : "citizens"} · ${stats.users.agents} ${locale === "fa" ? "ایجنت" : "agents"}`
              : undefined
          }
          tone="primary"
        />
        <StatTile
          icon={<UserCheck className="h-4 w-4" />}
          label={t("admin.agents_online")}
          value={stats?.users.agents_online ?? "—"}
          caption={
            stats
              ? `${stats.users.agents_online}/${stats.users.agents} ${locale === "fa" ? "آنلاین" : "online"}`
              : undefined
          }
          tone="success"
        />
        <StatTile
          icon={<TicketIcon className="h-4 w-4" />}
          label={t("admin.total_tickets")}
          value={stats?.tickets.total ?? "—"}
          caption={
            stats
              ? `${stats.tickets.open ?? 0} ${locale === "fa" ? "باز" : "open"}`
              : undefined
          }
          tone="primary"
        />
        <StatTile
          icon={<Building2 className="h-4 w-4" />}
          label={locale === "fa" ? "کسب‌وکارها" : "Businesses"}
          value={stats?.directory.businesses ?? "—"}
          caption={
            stats
              ? `${stats.directory.categories} ${locale === "fa" ? "دسته" : "categories"}`
              : undefined
          }
          tone="warning"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              {t("admin.tickets_14d")}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {analytics === null ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : analytics.daily.every((d) => d.total === 0) ? (
              <EmptyState
                icon={<Activity className="h-5 w-5" />}
                title={t("admin.no_data")}
                className="h-full border-0"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.daily}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => (v as string).slice(5)}
                    stroke="currentColor"
                    opacity={0.5}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    opacity={0.5}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    name={locale === "fa" ? "کل" : "Total"}
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    name={locale === "fa" ? "حل‌شده" : "Resolved"}
                  />
                  <Line
                    type="monotone"
                    dataKey="sos"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    name="SOS"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4 text-primary" />
              {t("admin.by_status")}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {analytics === null ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : statusPieData.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title={t("admin.no_data")}
                className="h-full border-0"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {statusPieData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={STATUS_COLORS[entry.key] ?? "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By category + top agents */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-primary" />
              {t("admin.by_category")}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {analytics === null ? (
              <Skeleton className="h-full" />
            ) : analytics.by_category.every((c) => c.count === 0) ? (
              <EmptyState
                icon={<Tag className="h-5 w-5" />}
                title={t("admin.no_data")}
                className="h-full border-0"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.by_category.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    opacity={0.5}
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    opacity={0.7}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#6366f1"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-primary" />
              {t("admin.top_agents")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics === null ? (
              <Skeleton className="h-40" />
            ) : analytics.top_agents.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title={t("admin.no_data")}
                className="border-0"
              />
            ) : (
              <ul className="divide-y">
                {analytics.top_agents.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          a.is_online ? "bg-success" : "bg-muted-foreground/50",
                        )}
                      />
                      <span className="text-sm font-medium">{a.name}</span>
                    </div>
                    <Badge variant="secondary">
                      {a.count}{" "}
                      {locale === "fa" ? "تیکت" : "tickets"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick status tiles */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(["open", "queued", "in_progress", "resolved", "cancelled"] as const).map(
          (s) => (
            <Card key={s}>
              <CardContent className="flex items-center gap-3 p-4">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md",
                    s === "resolved"
                      ? "bg-success/15 text-success"
                      : s === "queued"
                        ? "bg-warning/15 text-warning"
                        : s === "cancelled"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-primary/10 text-primary",
                  )}
                >
                  {s === "resolved" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : s === "cancelled" ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : s === "queued" ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <Inbox className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {s.replace("_", " ")}
                  </div>
                  <div className="text-lg font-semibold">
                    {stats?.tickets[s] ?? 0}
                  </div>
                </div>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href="/admin/users">
            <Users className="h-4 w-4" /> {t("admin.manage_users")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/categories">
            <Tag className="h-4 w-4" /> {t("admin.manage_categories")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/businesses">
            <Building2 className="h-4 w-4" /> {t("admin.manage_businesses")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/tickets">
            <TicketIcon className="h-4 w-4" /> {t("admin.browse_tickets")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  caption?: string;
  tone: "primary" | "success" | "warning";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
  } as const;
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
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
          {caption ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {caption}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
