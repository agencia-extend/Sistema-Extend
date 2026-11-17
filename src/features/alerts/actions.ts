"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { ok } from "@/domain/shared/result";
import { createClient } from "@/lib/supabase/server";
import { ackAlertSchema, resolveAlertSchema } from "./schemas";

/** Reconhecer: "estou cuidando". Os avisos diários deste alerta param. A regra de quem pode está no banco. */
export const ackAlert = defineAction({ schema: ackAlertSchema, permission: ["ads.manage", "ads.connect"] }, async ({ id }) => {
  const supabase = await createClient();
  must(await supabase.rpc("ack_ad_alert", { p_id: id }));
  revalidatePath("/trafego/alertas");
  revalidatePath("/clientes/[id]/anuncios", "page");
  return ok(null, "Alerta reconhecido. Os avisos diários dele param.");
});

/** Resolver com a nota de como foi resolvido; o restante do tráfego do cliente recebe o aviso. */
export const resolveAlert = defineAction({ schema: resolveAlertSchema, permission: ["ads.manage", "ads.connect"] }, async ({ id, note }) => {
  const supabase = await createClient();
  must(await supabase.rpc("resolve_ad_alert", { p_id: id, p_note: note }));
  revalidatePath("/trafego/alertas");
  revalidatePath("/clientes/[id]/anuncios", "page");
  return ok(null, "Alerta resolvido.");
});
