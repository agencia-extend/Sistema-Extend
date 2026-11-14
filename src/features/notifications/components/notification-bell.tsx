"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { usePostgresChanges } from "@/lib/supabase/use-postgres-changes";
import { formatRelative } from "@/domain/shared/dates";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string | null; href: string | null; read_at: string | null; created_at: string };

export function NotificationBell({
  userId,
  initialUnread,
  settingsHref = "/configuracoes/notificacoes",
  emptyText = "Nada por aqui. Quando alguém atribuir uma demanda a você ou algo mudar nos seus clientes, aparece aqui.",
}: {
  userId: string;
  initialUnread: number;
  settingsHref?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const supabase = createClient();
    const [list, count] = await Promise.all([
      supabase.from("notifications").select("id, title, body, href, read_at, created_at").order("created_at", { ascending: false }).limit(20),
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    ]);
    if (list.error) {
      setError(true);
      return;
    }
    setError(false);
    setItems(list.data as Item[]);
    setUnread(count.count ?? 0);
  }, []);

  // Tempo real: nova notificação aparece no sino sem recarregar.
  usePostgresChanges(`notificacoes:${userId}`, { event: "INSERT", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
    const n = payload.new as Item;
    setUnread((u) => u + 1);
    setItems((prev) => (prev ? [n, ...prev].slice(0, 20) : prev));
    toast(n.title, { description: n.body ?? undefined });
  });

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) void load();
  };

  const readOne = (n: Item) => {
    if (n.read_at) return;
    setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? prev);
    setUnread((u) => Math.max(0, u - 1));
    void markNotificationRead({ id: n.id });
  };

  const readAll = () =>
    startTransition(async () => {
      const res = await markAllNotificationsRead({});
      if (!res.ok) return void toast.error(res.message);
      setUnread(0);
      setItems((prev) => prev?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? prev);
    });

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-10" aria-label={unread ? `Notificações: ${unread} não lidas` : "Notificações"}>
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white tabular">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notificações</h2>
          <Button variant="ghost" size="sm" onClick={readAll} disabled={pending || unread === 0}>
            <CheckCheck aria-hidden="true" /> Marcar tudo como lido
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto" aria-live="polite">
          {error && (
            <div className="grid gap-2 px-4 py-6 text-sm">
              <p className="text-danger">Não foi possível carregar as notificações.</p>
              <Button variant="outline" size="sm" onClick={() => void load()} className="justify-self-start">
                Tentar de novo
              </Button>
            </div>
          )}
          {!error && items === null && <p className="px-4 py-6 text-sm text-muted-foreground">Carregando…</p>}
          {!error && items?.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">{emptyText}</p>
          )}
          {items?.map((n) => {
            const body = (
              <>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand")} aria-hidden="true" />
                <span className="grid min-w-0 gap-0.5">
                  <span className={cn("text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
                  {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                  <span className="text-xs text-muted-foreground">{formatRelative(n.created_at)}</span>
                </span>
              </>
            );
            const cls = "flex w-full gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted/60";
            return n.href ? (
              <Link key={n.id} href={n.href} className={cls} onClick={() => (readOne(n), setOpen(false))}>
                {body}
              </Link>
            ) : (
              <button key={n.id} type="button" className={cls} onClick={() => readOne(n)}>
                {body}
              </button>
            );
          })}
        </div>
        <div className="border-t px-4 py-2.5">
          <Link href={settingsHref} className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen(false)}>
            Preferências e notificações no celular
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
