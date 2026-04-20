"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Search, ShieldCheck, UserCog, Users2 } from "lucide-react";
import { api, User } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, initials } from "@/lib/utils";

type Filter = "all" | "citizen" | "agent" | "admin";

export default function AdminUsersPage() {
  const { ready } = useRequireAuth("admin");
  const { t, locale } = useI18n();
  const [users, setUsers] = useState<User[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!ready) return;
    void api.get<User[]>("/api/users").then(setUsers);
  }, [ready]);

  const filtered = useMemo(() => {
    const base = users ?? [];
    return base.filter((u) => {
      if (filter !== "all" && u.role !== filter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !u.full_name.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !(u.city ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [users, filter, query]);

  if (!ready) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.users")}</h1>
        <p className="text-sm text-muted-foreground">
          {locale === "fa"
            ? "کاربران سیستم — شهروندان، ایجنت‌ها و ادمین‌ها."
            : "System users — citizens, agents and admins."}
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
            <TabsTrigger value="citizen">
              {locale === "fa" ? "شهروند" : "Citizens"}
            </TabsTrigger>
            <TabsTrigger value="agent">
              {locale === "fa" ? "ایجنت" : "Agents"}
            </TabsTrigger>
            <TabsTrigger value="admin">
              {locale === "fa" ? "ادمین" : "Admins"}
            </TabsTrigger>
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

      {users === null ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users2 className="h-5 w-5" />}
          title={t("common.noresults")}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{t("common.name")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.email")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.role")}</th>
                  <th className="px-4 py-3 font-medium">
                    {t("common.location")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("common.status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/15 text-primary">
                            {initials(u.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          u.role === "admin"
                            ? "default"
                            : u.role === "agent"
                              ? "warning"
                              : "secondary"
                        }
                        className="gap-1"
                      >
                        {u.role === "admin" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : u.role === "agent" ? (
                          <UserCog className="h-3 w-3" />
                        ) : null}
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.city ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {u.city}
                        </span>
                      ) : (
                        "—"
                      )}
                      {u.lat && u.lng ? (
                        <span className="block text-[10px]">
                          {u.lat.toFixed(3)}, {u.lng.toFixed(3)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {u.role === "agent" ? (
                        <span className="inline-flex items-center gap-2 text-xs">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              u.is_online
                                ? "bg-success"
                                : "bg-muted-foreground/50",
                            )}
                          />
                          {u.is_online
                            ? t("common.online")
                            : t("common.offline")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
