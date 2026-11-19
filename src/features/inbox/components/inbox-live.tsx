"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Atualiza a tela quando chega mensagem ou a conversa muda (Realtime; a RLS decide o que cada pessoa recebe). */
export function InboxLive() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 500);
    };
    const channel = supabase
      .channel("atendimento")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversations" }, soon)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);
  return null;
}
