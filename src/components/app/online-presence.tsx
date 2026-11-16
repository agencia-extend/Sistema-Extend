"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { initials } from "@/components/app/user-menu";
import { onlineLabel, onlinePeople, type OnlinePerson, type PresenceMeta } from "@/domain/presence";
import { createClient } from "@/lib/supabase/client";

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/**
 * Quem da equipe está com o sistema aberto agora (canal privado do Realtime por organização;
 * a política em realtime.messages só deixa entrar a equipe ativa). Some se o canal não conectar.
 */
export function OnlinePresence({ me }: { me: { id: string; name: string; role: string; orgId: string } }) {
  const [people, setPeople] = useState<OnlinePerson[] | null>(null);
  const { id, name, role, orgId } = me;

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;
    const at = new Date().toISOString();

    const retry = () => {
      if (stopped) return;
      if (channel) void supabase.removeChannel(channel);
      channel = null;
      setPeople(null);
      clearTimeout(timer);
      timer = setTimeout(join, Math.min(30_000, 1_000 * 2 ** attempt++));
    };

    function join() {
      if (stopped) return;
      const ch = supabase.channel(`equipe:${orgId}`, { config: { private: true, presence: { key: id } } });
      channel = ch;
      ch.on("presence", { event: "sync" }, () => {
        if (channel !== ch) return;
        setPeople(onlinePeople(ch.presenceState<PresenceMeta>(), id));
      }).subscribe((status) => {
        if (channel !== ch) return;
        if (status === "SUBSCRIBED") {
          attempt = 0;
          void ch.track({ id, name, role, at } satisfies PresenceMeta);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") retry();
      });
    }

    timer = setTimeout(join, 300);
    return () => {
      stopped = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [id, name, role, orgId]);

  if (!people?.length) return null;
  const label = onlineLabel(people.length);
  const others = people.filter((p) => !p.me);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-10 gap-1.5 rounded-full px-2.5 sm:px-3" aria-label={`Equipe online: ${label}`}>
          <span className="relative">
            <Users className="size-4" aria-hidden="true" />
            <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-success ring-2 ring-background" aria-hidden="true" />
          </span>
          <span className="tabular text-sm sm:hidden" aria-hidden="true">{people.length}</span>
          <span className="text-sm max-sm:hidden" aria-hidden="true">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Equipe online agora</p>
          <p className="text-xs text-muted-foreground">
            {others.length === 0 ? "Ninguém mais está com o sistema aberto." : `${others.length} ${others.length === 1 ? "pessoa além de você" : "pessoas além de você"}.`}
          </p>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1" aria-label="Pessoas online">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2">
              <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">
                {initials(p.name)}
                <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-success ring-2 ring-popover" />
              </span>
              <span className="grid min-w-0">
                <span className="truncate text-sm font-medium">{p.me ? `${p.name} (você)` : p.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {p.role ? `${p.role} · ` : ""}desde {time.format(new Date(p.since))}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
