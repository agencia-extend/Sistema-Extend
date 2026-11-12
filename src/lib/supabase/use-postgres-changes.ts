"use client";

import { useEffect, useRef } from "react";
import { createClient } from "./client";

type Spec = { event: "INSERT" | "UPDATE" | "DELETE" | "*"; table: string; filter?: string };

/**
 * Assina mudanças de uma tabela pelo Supabase Realtime (a RLS do usuário vale).
 *
 * A inscrição é adiada por um instante e refeita quando o servidor a recusa ou a
 * conexão cai: entrar, sair e entrar de novo no mesmo canal em sequência (remontagem
 * do componente) faz o Realtime responder "Unable to subscribe to changes" e o canal
 * fica mudo sem avisar.
 */
export function usePostgresChanges(topic: string, spec: Spec, onChange: (payload: { new: unknown; old: unknown }) => void) {
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  });
  const { event, table, filter } = spec;

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const retry = () => {
      if (stopped) return;
      if (channel) void supabase.removeChannel(channel);
      channel = null;
      clearTimeout(timer);
      timer = setTimeout(subscribe, Math.min(15_000, 1_000 * 2 ** attempt++));
    };

    function subscribe() {
      if (stopped) return;
      const ch = supabase.channel(topic);
      channel = ch;
      ch.on("postgres_changes" as never, { event, schema: "public", table, ...(filter ? { filter } : {}) } as never, (payload: { new: unknown; old: unknown }) => handler.current(payload))
        .on("system" as never, {} as never, (msg: { status?: string }) => {
          if (channel !== ch) return;
          if (msg?.status === "error") retry();
          else if (msg?.status === "ok") attempt = 0;
        })
        .subscribe((status) => {
          if (channel !== ch) return;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") retry();
        });
    }

    timer = setTimeout(subscribe, 150);
    return () => {
      stopped = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [topic, event, table, filter]);
}
