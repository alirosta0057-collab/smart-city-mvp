"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Tag,
  Store,
  Ticket,
  Inbox,
  ListTodo,
  Map as MapIcon,
  LogIn,
  LogOut,
  UserPlus,
  Sun,
  Moon,
  Monitor,
  Languages,
  Menu,
  Sparkles,
  Globe2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n, type I18nKey } from "@/lib/i18n";
import { cn, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type IconType = React.ComponentType<{ className?: string }>;
type NavItem = { href: string; icon: IconType; key: I18nKey; match?: string };

function navForRole(role?: string): NavItem[] {
  if (role === "admin") {
    return [
      { href: "/admin", icon: LayoutDashboard, key: "nav.dashboard" },
      { href: "/admin/tickets", icon: Ticket, key: "nav.tickets" },
      { href: "/admin/users", icon: Users, key: "nav.users" },
      { href: "/admin/businesses", icon: Store, key: "nav.businesses" },
      { href: "/admin/categories", icon: Tag, key: "nav.categories" },
    ];
  }
  if (role === "agent") {
    return [
      { href: "/agent", icon: Inbox, key: "nav.queue" },
      { href: "/agent/active", icon: ListTodo, key: "nav.active" },
    ];
  }
  return [
    { href: "/citizen", icon: MapIcon, key: "nav.services" },
    { href: "/citizen/tickets", icon: Ticket, key: "nav.my_tickets" },
  ];
}

function ThemeSwitcher() {
  const { theme, setTheme, locale, setLocale } = useTheme();
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.theme", "Theme")}
          >
            {theme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : theme === "light" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Monitor className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel>{t("common.theme", "Theme")}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setTheme("light")}>
            <Sun className="h-4 w-4" /> Light
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme("dark")}>
            <Moon className="h-4 w-4" /> Dark
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme("system")}>
            <Monitor className="h-4 w-4" /> System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.language", "Language")}
          >
            <Languages className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel>{t("common.language", "Language")}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setLocale("en")}>
            <Globe2 className="h-4 w-4" /> English {locale === "en" && "✓"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setLocale("fa")}>
            <Globe2 className="h-4 w-4" /> فارسی {locale === "fa" && "✓"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setLocale("tr")}>
            <Globe2 className="h-4 w-4" /> Türkçe {locale === "tr" && "✓"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setLocale("ar")}>
            <Globe2 className="h-4 w-4" /> العربية {locale === "ar" && "✓"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link href="/login">
            <LogIn className="h-4 w-4" /> {t("nav.login")}
          </Link>
        </Button>
        <Button variant="brand" asChild>
          <Link href="/register">
            <UserPlus className="h-4 w-4" /> {t("nav.signup")}
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full border bg-card px-1.5 py-1 pr-3 text-sm shadow-sm transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-7 w-7">
            <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
          </Avatar>
          <span className="hidden font-medium sm:inline">
            {user.full_name}
          </span>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {user.role}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-foreground">
            {user.full_name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            logout();
            router.replace("/login");
          }}
        >
          <LogOut className="h-4 w-4" /> {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname() ?? "/";
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isPublic =
    !user ||
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");

  const nav = navForRole(user?.role);

  if (isPublic) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="container flex h-16 items-center justify-between gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <span>{t("brand.name")}</span>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 z-40 flex w-64 flex-col border-r bg-card transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-base font-bold">{t("brand.name")}</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-success" />
            <span>Live</span>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen flex-1 flex-col md:pl-0">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {user
                  ? t(
                      `nav.${user.role === "admin" ? "dashboard" : user.role === "agent" ? "queue" : "services"}` as I18nKey,
                    )
                  : null}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
