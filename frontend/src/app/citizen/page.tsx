"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Crosshair,
  LayoutGrid,
  Loader2,
  MapPin,
  Phone,
  Search,
  Send,
  Sparkles,
  SquareArrowOutUpRight,
  Store,
} from "lucide-react";
import { api, Category, NearbyPlace, Ticket } from "@/lib/api";
import { useAuth, useRequireAuth } from "@/lib/auth";
import { resolveLocation } from "@/lib/geo";
import { useI18n } from "@/lib/i18n";
import { formatKm } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toaster";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

type PriorityOption = "low" | "normal" | "high";

export default function CitizenHome() {
  const { user, ready } = useRequireAuth("citizen");
  const { refresh } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { t, locale } = useI18n();

  const [categories, setCategories] = useState<Category[]>([]);
  const [rawPlaces, setRawPlaces] = useState<NearbyPlace[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  const loadBusinesses = useCallback(async () => {
    if (!user || user.lat == null || user.lng == null) {
      setRawPlaces([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("lat", String(user.lat));
      params.set("lng", String(user.lng));
      params.set("radius_m", "3000");
      if (selectedSlug) params.set("category_slug", selectedSlug);
      const data = await api.get<NearbyPlace[]>(
        `/api/places/nearby?${params.toString()}`,
      );
      setRawPlaces(data);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to load nearby places",
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedSlug, toast, user]);

  // Search is a pure client-side filter over the fetched OSM results, so
  // typing never refetches from Overpass (keeps us well under its rate
  // limit and avoids skeleton flashes on each keystroke).
  const businesses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rawPlaces;
    return rawPlaces.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        (p.address ?? "").toLowerCase().includes(needle),
    );
  }, [rawPlaces, q]);

  useEffect(() => {
    if (!ready) return;
    api
      .get<Category[]>("/api/categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    void loadBusinesses();
  }, [ready, loadBusinesses]);

  useEffect(() => {
    // Re-resolve location on every dashboard mount so the map reflects the
    // user's current physical location, not a stale value carried over from
    // a previous login (including, in demos, a different person using the
    // same shared account). If browser geolocation is allowed, Chrome caches
    // the permission so this is silent after first grant; otherwise we fall
    // through to IP lookup.
    if (!ready || !user) return;
    void detectLocation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id]);

  async function detectLocation(silent = false) {
    setLocating(true);
    try {
      const geo = await resolveLocation({ preferFresh: true });
      await api.post("/api/auth/locate", {
        lat: geo.lat,
        lng: geo.lng,
        city: geo.city,
        country: geo.country,
      });
      // refresh() updates `user` with the new lat/lng, which recreates the
      // `loadBusinesses` callback (user is in its deps) and re-runs the
      // effect at the top of the component. We don't call loadBusinesses
      // directly here, because that closure still holds the *old* user and
      // would race with the effect-driven refetch against the new coords.
      await refresh();
      if (!silent) {
        toast({
          variant: "success",
          title: "Location updated",
          description:
            geo.source === "browser"
              ? `Using high-accuracy browser location${geo.city ? ` · ${geo.city}` : ""}`
              : `Approximate location via IP${geo.city ? ` · ${geo.city}` : ""}`,
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Location failed",
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setLocating(false);
    }
  }

  function openTicketDialog(category: Category | null = null) {
    setActiveCategory(category);
    setTicketOpen(true);
  }

  async function submitTicket(data: {
    subject: string;
    description: string;
    category_id: number | null;
    priority: PriorityOption;
  }) {
    const ticket = await api.post<Ticket>("/api/tickets", {
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      category_id: data.category_id,
      lat: user?.lat ?? null,
      lng: user?.lng ?? null,
    });
    toast({
      variant: "success",
      title: `Ticket #${ticket.id} opened`,
      description: "City Bot is connecting — you can start chatting now.",
    });
    router.push(`/citizen/tickets/chat?id=${ticket.id}`);
  }

  async function submitSOS(description: string) {
    const ticket = await api.post<Ticket>("/api/tickets", {
      subject: "SOS — emergency assistance",
      description: description.trim() || "SOS — urgent assistance needed",
      priority: "sos",
      lat: user?.lat ?? null,
      lng: user?.lng ?? null,
    });
    toast({
      variant: "destructive",
      title: `SOS dispatched · #${ticket.id}`,
      description: "Routing to the nearest online agent.",
    });
    router.push(`/citizen/tickets/chat?id=${ticket.id}`);
  }

  const mapCenter: [number, number] = useMemo(() => {
    if (user?.lat != null && user?.lng != null) return [user.lat, user.lng];
    if (businesses[0]) return [businesses[0].lat, businesses[0].lng];
    return [35.6892, 51.389];
  }, [user, businesses]);

  const mapMarkers = useMemo(
    () =>
      businesses.map((b) => ({
        id: b.id,
        lat: b.lat,
        lng: b.lng,
        title: b.name,
        subtitle: `${b.category.name} · ${formatKm(b.distance_km)}`,
        icon: b.category.icon ?? "📍",
        accent: "primary" as const,
      })),
    [businesses],
  );


  const greeting = useMemo(() => {
    if (!user) return "";
    const first = user.full_name.split(" ")[0];
    return `${t("citizen.hello", "Hello")}, ${first}`;
  }, [user, t]);

  const locationLabel = useMemo(() => {
    if (!user?.lat || !user.lng) return t("citizen.location_detecting");
    return `${user.city ?? "Unknown"}${user.country ? " · " + user.country : ""} · ${user.lat.toFixed(3)}, ${user.lng.toFixed(3)}`;
  }, [user, t]);

  if (!ready || !user) return null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-hero p-8 text-white shadow-xl">
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #fff 1px, transparent 1.5px), radial-gradient(circle at 70% 80%, #fff 1px, transparent 1.5px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <Badge
              variant="secondary"
              className="bg-white/15 text-white hover:bg-white/20"
            >
              <Sparkles className="h-3 w-3" />
              {t("brand.name")}
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {greeting} 👋
            </h1>
            <p className="flex items-center gap-2 text-sm text-white/85">
              <MapPin className="h-4 w-4" />
              {locationLabel}
            </p>
            <p className="max-w-lg text-sm text-white/75">
              {locale === "fa"
                ? "خدمات شهری نزدیک به شما، چت با دستیار هوشمند و در صورت نیاز اتصال فوری به ایجنت انسانی."
                : "Your city's services, one tap away. Chat with our smart assistant and escalate to a human agent instantly when needed."}
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                size="lg"
                variant="sos"
                onClick={() => setSosOpen(true)}
                className="shadow-2xl shadow-destructive/40"
              >
                <AlertTriangle className="h-5 w-5" />
                {t("citizen.sos_full", "Emergency SOS")}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => openTicketDialog()}
                className="bg-white/15 text-white hover:bg-white/25"
              >
                <Send className="h-4 w-4" />
                {t("citizen.open_ticket", "Open a ticket")}
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => void detectLocation(false)}
                disabled={locating}
                className="text-white hover:bg-white/15"
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Crosshair className="h-4 w-4" />
                )}
                {t("citizen.relocate")}
              </Button>
            </div>
          </div>
          <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:w-auto">
            <MiniStat
              label={
                locale === "fa" ? "کسب‌وکارهای نزدیک" : "Nearby businesses"
              }
              value={businesses.length.toString()}
            />
            <MiniStat
              label={locale === "fa" ? "دسته‌بندی‌ها" : "Categories"}
              value={categories.length.toString()}
            />
            <MiniStat
              label={locale === "fa" ? "میانگین فاصله" : "Avg. distance"}
              value={
                businesses.length > 0
                  ? formatKm(
                      businesses.reduce((s, b) => s + b.distance_km, 0) /
                        businesses.length,
                    )
                  : "—"
              }
            />
            <MiniStat
              label={locale === "fa" ? "نزدیک‌ترین" : "Closest"}
              value={
                businesses.length > 0
                  ? formatKm(businesses[0].distance_km)
                  : "—"
              }
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {t("citizen.categories", "Explore categories")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {locale === "fa"
                ? "برای فیلتر لیست، کلیک کنید. برای ایجاد تیکت در دسته، دبل‌کلیک کنید."
                : "Click to filter. Double-click to open a ticket in a category."}
            </p>
          </div>
          {selectedSlug ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSlug("")}
            >
              {t("common.all", "All")}
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <CategoryTile
            active={!selectedSlug}
            icon="🌆"
            name={t("common.all", "All")}
            description={
              locale === "fa" ? "مشاهدهٔ همه" : "Browse everything"
            }
            onClick={() => setSelectedSlug("")}
          />
          {categories.map((c) => (
            <CategoryTile
              key={c.id}
              active={selectedSlug === c.slug}
              icon={c.icon ?? "🏷️"}
              name={c.name}
              description={c.description ?? undefined}
              onClick={() => setSelectedSlug(c.slug)}
              onDoubleClick={() => openTicketDialog(c)}
            />
          ))}
        </div>
      </section>

      {/* Map + list */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{t("citizen.nearby")}</h2>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs defaultValue="map" className="space-y-3">
          <TabsList>
            <TabsTrigger value="map">
              <MapPin className="h-4 w-4" />
              {t("citizen.map", "Map")}
            </TabsTrigger>
            <TabsTrigger value="list">
              <LayoutGrid className="h-4 w-4" />
              {t("citizen.list", "List")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map">
            <CityMap
              center={mapCenter}
              zoom={13}
              userPoint={
                user.lat != null && user.lng != null
                  ? { lat: user.lat, lng: user.lng, label: user.full_name }
                  : null
              }
              markers={mapMarkers}
              height="440px"
              rounded
              onMarkerClick={(id) => {
                const safe = String(id).replace(/[^a-z0-9]/gi, "_");
                const el = document.getElementById(`biz-${safe}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("ring-2", "ring-primary");
                  setTimeout(
                    () => el.classList.remove("ring-2", "ring-primary"),
                    2000,
                  );
                }
              }}
            />
          </TabsContent>

          <TabsContent value="list">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : businesses.length === 0 ? (
              <EmptyState
                icon={<Store className="h-8 w-8 text-muted-foreground" />}
                title={t("common.noresults")}
                description={
                  locale === "fa"
                    ? "فیلتر یا جستجو را تغییر دهید."
                    : "Try a different category or search term."
                }
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {businesses.map((b) => (
                  <BusinessCard key={b.id} biz={b} />
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <TicketDialog
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        categories={categories}
        preselected={activeCategory}
        onSubmit={submitTicket}
      />
      <SOSDialog open={sosOpen} onOpenChange={setSosOpen} onSubmit={submitSOS} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
      <div className="text-[11px] uppercase tracking-wide text-white/70">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function CategoryTile({
  active,
  icon,
  name,
  description,
  onClick,
  onDoubleClick,
}: {
  active: boolean;
  icon: string;
  name: string;
  description?: string;
  onClick: () => void;
  onDoubleClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={
        "group rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md " +
        (active
          ? "border-primary/60 ring-1 ring-primary/50 bg-primary/5"
          : "")
      }
      title={onDoubleClick ? "Double-click to open a ticket" : undefined}
    >
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 font-medium leading-tight">{name}</div>
      {description ? (
        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {description}
        </div>
      ) : null}
    </button>
  );
}

function BusinessCard({ biz }: { biz: NearbyPlace }) {
  return (
    <li
      id={`biz-${String(biz.id).replace(/[^a-z0-9]/gi, "_")}`}
      className="group rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary/10 text-xl">
            {biz.category.icon ?? "🏷️"}
          </span>
          <div>
            <h3 className="font-semibold leading-tight">{biz.name}</h3>
            <p className="text-xs text-muted-foreground">
              {biz.category.name}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="tabular-nums">
          {formatKm(biz.distance_km)}
        </Badge>
      </div>
      {biz.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
          {biz.description}
        </p>
      ) : null}
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {biz.address ? (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            {biz.address}
          </div>
        ) : null}
        {biz.phone ? (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" />
            <a href={`tel:${biz.phone}`} className="hover:underline">
              {biz.phone}
            </a>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <a
          className="inline-flex items-center gap-1 text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
          href={`https://www.openstreetmap.org/?mlat=${biz.lat}&mlon=${biz.lng}#map=17/${biz.lat}/${biz.lng}`}
        >
          <SquareArrowOutUpRight className="h-3 w-3" />
          Open in map
        </a>
        <span className="tabular-nums text-muted-foreground">
          {biz.lat.toFixed(3)}, {biz.lng.toFixed(3)}
        </span>
      </div>
    </li>
  );
}

function TicketDialog({
  open,
  onOpenChange,
  categories,
  preselected,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  preselected: Category | null;
  onSubmit: (data: {
    subject: string;
    description: string;
    category_id: number | null;
    priority: PriorityOption;
  }) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [priority, setPriority] = useState<PriorityOption>("normal");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject(
        preselected
          ? `Help with ${preselected.name}`
          : locale === "fa"
          ? "کمک برای..."
          : "Help with…",
      );
      setDescription("");
      setCategoryId(preselected?.id ?? "");
      setPriority("normal");
    }
  }, [open, preselected, locale]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        subject: subject.trim(),
        description: description.trim(),
        category_id: typeof categoryId === "number" ? categoryId : null,
        priority,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not open ticket",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("citizen.ticket_modal_title")}</DialogTitle>
          <DialogDescription>
            {t("citizen.ticket_modal_desc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">{t("common.subject")}</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              minLength={2}
              maxLength={200}
              placeholder={
                locale === "fa" ? "موضوع کوتاه" : "A short subject"
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t("common.description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={2}
              rows={4}
              placeholder={
                locale === "fa"
                  ? "جزئیات درخواست را توضیح دهید..."
                  : "Describe what you need help with…"
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="category">{t("citizen.category")}</Label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) =>
                  setCategoryId(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">
                  {locale === "fa" ? "عمومی" : "General"}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ?? "🏷️"} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">{t("citizen.priority")}</Label>
              <select
                id="priority"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as PriorityOption)
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="brand" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t("common.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SOSDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (description: string) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setDescription("");
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(description);
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "SOS failed",
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t("citizen.sos_full")}
          </DialogTitle>
          <DialogDescription>
            {locale === "fa"
              ? "درخواست شما فوراً به نزدیک‌ترین ایجنت آنلاین ارسال می‌شود."
              : "Your request will be sent straight to the nearest online agent."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sos-desc">{t("common.description")}</Label>
            <Textarea
              id="sos-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={
                locale === "fa"
                  ? "چه اتفاقی افتاده؟ (اختیاری)"
                  : "What is happening? (optional)"
              }
            />
          </div>
          <Card className="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <div>
                {locale === "fa"
                  ? "در صورت خطر جانی فوری، علاوه بر این درخواست با خدمات اورژانس محلی نیز تماس بگیرید."
                  : "If there is immediate danger to life, also contact your local emergency services directly."}
              </div>
            </div>
          </Card>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="sos" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {t("citizen.sos_full")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
