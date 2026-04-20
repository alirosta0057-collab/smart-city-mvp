"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, Loader2, MapPin, Phone, Plus, Trash2 } from "lucide-react";
import { api, Business, Category } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";

export default function AdminBusinessesPage() {
  const { ready } = useRequireAuth("admin");
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    lat: "",
    lng: "",
    category_id: "",
  });

  const load = useCallback(async () => {
    const [cats, list] = await Promise.all([
      api.get<Category[]>("/api/categories"),
      api.get<Business[]>("/api/businesses"),
    ]);
    setCategories(cats);
    setBusinesses(list);
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/businesses", {
        name: form.name,
        phone: form.phone || null,
        address: form.address || null,
        lat: Number(form.lat),
        lng: Number(form.lng),
        category_id: Number(form.category_id),
      });
      setForm({
        name: "",
        phone: "",
        address: "",
        lat: "",
        lng: "",
        category_id: form.category_id,
      });
      setOpen(false);
      await load();
      toast({
        title: locale === "fa" ? "ثبت شد" : "Business added",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    if (
      !window.confirm(
        locale === "fa" ? "حذف این کسب‌وکار؟" : "Delete this business?",
      )
    )
      return;
    try {
      await api.del(`/api/businesses/${id}`);
      await load();
      toast({
        title: locale === "fa" ? "حذف شد" : "Deleted",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  if (!ready) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("nav.businesses")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locale === "fa"
              ? "کسب‌وکارهای عضو شهر — با مختصات برای تطبیق نزدیک‌ترین."
              : "City directory — includes coordinates for nearest-match."}
          </p>
        </div>
        <Button variant="brand" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          {locale === "fa" ? "افزودن کسب‌وکار" : "Add business"}
        </Button>
      </div>

      {businesses === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : businesses.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title={
            locale === "fa" ? "کسب‌وکاری ثبت نشده" : "No businesses yet"
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Card
              key={b.id}
              className="group transition-shadow hover:shadow-lg"
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{b.category.icon ?? "🏢"}</span>
                      <span className="font-semibold">{b.name}</span>
                    </div>
                    <Badge variant="secondary" className="mt-1">
                      {b.category.name}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => onDelete(b.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {b.address ? (
                  <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {b.address}
                  </div>
                ) : null}
                {b.phone ? (
                  <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {b.phone}
                  </div>
                ) : null}
                <div className="text-[10px] text-muted-foreground">
                  {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === "fa" ? "افزودن کسب‌وکار" : "Add business"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-name">{t("common.name")}</Label>
              <Input
                id="b-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-cat">
                {locale === "fa" ? "دسته‌بندی" : "Category"}
              </Label>
              <select
                id="b-cat"
                required
                value={form.category_id}
                onChange={(e) =>
                  setForm({ ...form, category_id: e.target.value })
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="">
                  {locale === "fa" ? "انتخاب کنید…" : "Choose…"}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-lat">Latitude</Label>
              <Input
                id="b-lat"
                required
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-lng">Longitude</Label>
              <Input
                id="b-lng"
                required
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-addr">{t("common.address")}</Label>
              <Input
                id="b-addr"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-phone">{t("common.phone")}</Label>
              <Input
                id="b-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="brand" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
