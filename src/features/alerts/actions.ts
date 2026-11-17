"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { ok } from "@/domain/shared/result";
import { createClient } from "@/lib/supabase/server";
import { ackAlertSchema, limitsSchema, resetLimitsSchema, resolveAlertSchema } from "./schemas";

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

/** Salva os limites do cliente (quem cuida do tráfego dele) ou o padrão da agência (quem conecta as integrações). */
export const saveAlertLimits = defineAction({ schema: limitsSchema, permission: ["ads.manage", "ads.connect"] }, async (l) => {
  const supabase = await createClient();
  must(await supabase.rpc("save_alert_limits", {
    p_client: l.clientId as string,
    p_funds_days: l.fundsDays,
    p_funds_min_cents: l.fundsMin as number,
    p_daily_spend_max_cents: l.dailySpendMax as number,
    p_no_delivery: l.noDelivery,
    p_fatigue_enabled: l.fatigueEnabled,
    p_fatigue_frequency: l.fatigueFrequency,
    p_fatigue_ctr_drop: l.fatigueCtrDrop,
  }));
  revalidatePath("/trafego/alertas");
  if (l.clientId) revalidatePath(`/clientes/${l.clientId}/anuncios`);
  return ok(null, l.clientId ? "Limites do cliente salvos. Valem a partir da próxima verificação." : "Padrão da agência salvo. Vale para os clientes sem limites próprios.");
});

/** O cliente volta a usar o padrão da agência. */
export const resetAlertLimits = defineAction({ schema: resetLimitsSchema, permission: "ads.manage" }, async ({ clientId }) => {
  const supabase = await createClient();
  must(await supabase.rpc("reset_alert_limits", { p_client: clientId }));
  revalidatePath(`/clientes/${clientId}/anuncios`);
  return ok(null, "O cliente voltou a usar o padrão da agência.");
});
