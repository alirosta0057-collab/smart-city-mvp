"use client";

import Link from "next/link";
import {
  Bot,
  MapPin,
  Shield,
  Zap,
  Users,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Siren,
  Store,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { homeForRole } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const { user } = useAuth();
  const { t } = useI18n();
  const ctaHref = user ? homeForRole(user.role) : "/login";
  const ctaLabel = user ? t("home.cta_dashboard") : t("home.cta_login");

  const FEATURES = [
    {
      icon: MapPin,
      title: t("home.feat_loc_title"),
      desc: t("home.feat_loc_desc"),
    },
    {
      icon: Bot,
      title: t("home.feat_bot_title"),
      desc: t("home.feat_bot_desc"),
    },
    {
      icon: Siren,
      title: t("home.feat_sos_title"),
      desc: t("home.feat_sos_desc"),
    },
    {
      icon: MessageSquare,
      title: t("home.feat_ws_title"),
      desc: t("home.feat_ws_desc"),
    },
    {
      icon: Shield,
      title: t("home.feat_rbac_title"),
      desc: t("home.feat_rbac_desc"),
    },
    {
      icon: Zap,
      title: t("home.feat_deploy_title"),
      desc: t("home.feat_deploy_desc"),
    },
  ];

  const STATS = [
    { label: t("home.stats_categories"), value: "10+" },
    { label: t("home.stats_businesses"), value: "12" },
    { label: t("home.stats_seed_users"), value: "4" },
    { label: t("home.stats_latency"), value: "<200ms" },
  ];

  const ROLES = [
    {
      icon: Users,
      title: t("home.role_citizens"),
      email: "citizen@smartcity.example",
      pass: "pass123",
      features: [
        t("home.role_citizen_f1"),
        t("home.role_citizen_f2"),
        t("home.role_citizen_f3"),
        t("home.role_citizen_f4"),
      ],
    },
    {
      icon: Shield,
      title: t("home.role_agents"),
      email: "agent@smartcity.example",
      pass: "pass123",
      features: [
        t("home.role_agent_f1"),
        t("home.role_agent_f2"),
        t("home.role_agent_f3"),
        t("home.role_agent_f4"),
      ],
    },
    {
      icon: Sparkles,
      title: t("home.role_admin"),
      email: "admin@smartcity.example",
      pass: "admin123",
      features: [
        t("home.role_admin_f1"),
        t("home.role_admin_f2"),
        t("home.role_admin_f3"),
        t("home.role_admin_f4"),
      ],
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero text-white">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35) 0, transparent 40%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.25) 0, transparent 35%), radial-gradient(circle at 50% 80%, rgba(255,255,255,0.15) 0, transparent 40%)",
          }}
        />
        <div className="container relative grid gap-10 py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-28">
          <div className="space-y-6">
            <Badge className="bg-white/10 text-white/90 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> {t("home.hero_badge")}
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              {t("home.hero_title")}{" "}
              <span className="bg-gradient-to-r from-sky-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">
                {t("home.hero_title_accent")}
              </span>
              .
            </h1>
            <p className="max-w-xl text-lg text-white/80">
              {t("home.hero_desc")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" variant="brand" asChild>
                <Link href={ctaHref}>
                  {ctaLabel} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                asChild
              >
                <Link href="#roles">{t("home.cta_demo")}</Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-sm text-white/70">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {t("home.check_ws")}
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {t("home.check_sos")}
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {t("home.check_rbac")}
              </span>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="absolute -right-20 -top-10 h-80 w-80 rounded-full bg-gradient-brand opacity-40 blur-3xl" />
            <Card className="glass relative border-white/10 bg-white/5 backdrop-blur-xl">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {t("home.card_detected")}
                    </div>
                    <div className="text-xs text-white/60">
                      {t("home.card_coords")}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
                  <div className="flex items-center justify-between text-white/70">
                    <span>{t("home.card_bot_label")}</span>
                    <span>Groq</span>
                  </div>
                  <div className="rounded-md bg-white/10 p-3 text-white">
                    {t("home.card_bot_msg")}
                  </div>
                  <div className="rounded-md bg-primary/80 p-3 text-end text-white">
                    {t("home.card_citizen_msg")}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                    {t("home.card_agent")}
                  </span>
                  <span>{t("home.card_latency")}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Stats */}
        <div className="container relative grid grid-cols-2 gap-4 pb-16 sm:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/10 bg-white/5 p-4 text-white backdrop-blur"
            >
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs uppercase tracking-wide text-white/60">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">
            {t("home.feat_badge")}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("home.feat_title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("home.feat_desc")}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="card-hover">
              <CardContent className="space-y-3 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-sm">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="border-y bg-muted/40 py-20">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Badge variant="outline" className="mb-4">
              {t("home.roles_badge")}
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("home.roles_title")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("home.roles_desc")}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {ROLES.map((r) => (
              <Card key={r.title} className="card-hover">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <r.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-semibold">{r.title}</h3>
                  </div>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {r.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-center gap-2 text-foreground/80"
                      >
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-lg bg-muted p-3 font-mono text-xs">
                    <div>{r.email}</div>
                    <div className="text-muted-foreground">{r.pass}</div>
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/login?email=${encodeURIComponent(r.email)}`}>
                      {t("home.sign_in_as")} {r.title}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="container grid items-center gap-6 py-16 md:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">
            {t("home.footer_title")}
          </h2>
          <p className="mt-2 text-muted-foreground">{t("home.footer_desc")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="brand" size="lg" asChild>
            <Link href={ctaHref}>
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/register">
              <Store className="h-4 w-4" /> {t("home.footer_create")}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
