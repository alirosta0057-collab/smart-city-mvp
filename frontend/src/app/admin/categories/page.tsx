"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Plus, Tag, Trash2 } from "lucide-react";
import { api, Category } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function AdminCategoriesPage() {
  const { ready } = useRequireAuth("admin");
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    icon: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    const rows = await api.get<Category[]>("/api/categories");
    setCategories(rows);
  }

  useEffect(() => {
    if (ready) void load();
  }, [ready]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/categories", {
        slug: form.slug,
        name: form.name,
        icon: form.icon || null,
        description: form.description || null,
      });
      setForm({ slug: "", name: "", icon: "", description: "" });
      setOpen(false);
      await load();
      toast({
        title: locale === "fa" ? "دسته اضافه شد" : "Category added",
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
        locale === "fa" ? "حذف این دسته؟" : "Delete this category?",
      )
    )
      return;
    try {
      await api.del(`/api/categories/${id}`);
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
            {t("nav.categories")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locale === "fa"
              ? "دسته‌بندی خدمات شهری — قابل ویرایش از همین صفحه."
              : "Service categories — editable here."}
          </p>
        </div>
        <Button variant="brand" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          {locale === "fa" ? "افزودن دسته" : "Add category"}
        </Button>
      </div>

      {categories === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<Tag className="h-5 w-5" />}
          title={locale === "fa" ? "دسته‌ای وجود ندارد" : "No categories yet"}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Card key={c.id} className="group transition-shadow hover:shadow-lg">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xl">
                    {c.icon ?? "📦"}
                  </span>
                  <div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {c.slug}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => onDelete(c.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardHeader>
              {c.description ? (
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {c.description}
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === "fa" ? "افزودن دستهٔ جدید" : "Add category"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input
                id="cat-slug"
                required
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="food"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">{t("common.name")}</Label>
              <Input
                id="cat-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={locale === "fa" ? "رستوران" : "Food"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-icon">
                {locale === "fa" ? "آیکون (اموجی)" : "Icon (emoji)"}
              </Label>
              <Input
                id="cat-icon"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="🍔"
                maxLength={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">{t("common.description")}</Label>
              <Input
                id="cat-desc"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <DialogFooter>
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
