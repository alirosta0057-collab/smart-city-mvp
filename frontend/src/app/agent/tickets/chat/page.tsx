"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { ChatRoom } from "@/components/ChatRoom";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";

function Inner() {
  const { ready } = useRequireAuth("agent");
  const params = useSearchParams();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const ticketId = Number(params?.get("id") ?? "");

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [resolving, setResolving] = useState(false);

  async function resolve() {
    setResolving(true);
    try {
      await api.post(`/api/tickets/${ticketId}/resolve`, {
        note: note.trim() || null,
      });
      toast({
        title: locale === "fa" ? "تیکت حل شد" : "Ticket resolved",
        variant: "success",
      });
      router.push("/agent");
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setResolving(false);
      setOpen(false);
    }
  }

  if (!ready || !ticketId) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/agent")}>
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
        <Button
          variant="brand"
          onClick={() => setOpen(true)}
          disabled={resolving}
        >
          {resolving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {t("agent.resolve")}
        </Button>
      </div>
      <ChatRoom ticketId={ticketId} selfKind="agent" showQuickReplies />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("agent.resolve_title")}</DialogTitle>
            <DialogDescription>
              {locale === "fa"
                ? "پس از حل، تیکت بسته می‌شود و شهروند پیام سیستم را می‌بیند."
                : "After resolving, the ticket is closed and the citizen sees a system message."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolve-note">{t("agent.resolve_note")}</Label>
            <Textarea
              id="resolve-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("agent.resolve_note_placeholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="brand" onClick={resolve} disabled={resolving}>
              {resolving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {t("agent.resolve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AgentChatPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
