"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import { syncMetaAccounts } from "@/lib/ads/meta-sync";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { goalIdSchema, goalSchema, reportNowSchema, syncNowSchema } from "./schemas";
import { periodRange } from "@/domain/ads";
import { lastWeek } from "@/domain/ads/report";
import { todayKey } from "@/domain/media";
import { sendClientReport } from "@/lib/whatsapp/reports";

/**
 * Sincronizar agora: as contas ligadas de um cliente (quem cuida do tráfego dele) ou todas (quem conecta).
 * Usa até ~50 s; o que não couber fica para a próxima sincronização automática.
 */
export const syncAdsNow = defineAction({ schema: syncNowSchema, permission: "ads.manage" }, async ({ clientId }, { user }) => {
  let accountIds: string[] | undefined;
  if (clientId) {
    const supabase = await createClient();
    const { data: can } = await supabase.rpc("can_manage_client_ads", { p_client: clientId });
    if (can !== true) return fail("forbidden", "Você não cuida do tráfego deste cliente.");
    const { data } = await createAdminClient().from("ad_accounts").select("id").eq("client_id", clientId).eq("organization_id", user.organizationId).eq("is_enabled", true);
    accountIds = (data ?? []).map((a) => a.id);
  } else if (!user.permissions["ads.connect"]) {
    return fail("forbidden", "Escolha um cliente para sincronizar.");
  } else {
    const { data } = await createAdminClient().from("ad_accounts").select("id").eq("organization_id", user.organizationId).eq("is_enabled", true);
    accountIds = (data ?? []).map((a) => a.id);
  }
  if (!accountIds.length) return fail("business_rule", "Nenhuma conta ligada para sincronizar. Ligue as contas em Configurações › Integrações.");
  const r = await syncMetaAccounts({ trigger: "manual", accountIds, budgetMs: 50_000 });
  revalidatePath("/trafego/painel");
  if (clientId) revalidatePath(`/clientes/${clientId}/anuncios`);
  if (r.total === 0) return fail("business_rule", "As contas ligadas estão sem conexão ativa com a Meta. Reconecte em Configurações › Integrações ou na aba Tráfego do cliente.");
  const failed = r.results.filter((x) => !x.ok);
  if (failed.length) return fail("network", `${failed[0].account}: ${failed[0].error}`);
  const rest = r.total - r.done;
  return ok(null, `${r.done} ${r.done === 1 ? "conta sincronizada" : "contas sincronizadas"}${rest ? `; ${rest} na próxima rodada` : ""}.`);
});

/** Envia agora o relatório do cliente (período da tela, ou a semana passada) para o grupo de relatórios do WhatsApp. */
export const sendReportNow = defineAction({ schema: reportNowSchema, permission: "ads.manage" }, async ({ clientId, period }, { user }) => {
  const supabase = await createClient();
  const { data: can } = await supabase.rpc("can_manage_client_ads", { p_client: clientId });
  if (can !== true) return fail("forbidden", "Você não cuida do tráfego deste cliente.");
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", clientId).single();
  if (!client) return fail("not_found", "Cliente não encontrado.");
  const today = todayKey(new Date());
  const range = period === "semana" ? lastWeek(today) : periodRange(period, today);
  const r = await sendClientReport(user.organizationId, client, range, { createdBy: user.id, frequency: period === "semana" ? "semanal" : "avulso" });
  if (r.error) return fail("business_rule", r.error);
  if (!r.sent) return fail("business_rule", "Sem gasto no período: não há o que relatar.");
  revalidatePath(`/clientes/${clientId}/relatorios`);
  if (r.pdfError) return ok(null, r.pdfError);
  return ok(null, "Relatório e PDF enviados para o grupo de relatórios. O PDF ficou na aba Relatórios do cliente.");
});

/** Meta do mês do cliente (uma por mês; salvar de novo substitui). A RLS confere quem otimiza o cliente. */
export const saveGoal = defineAction({ schema: goalSchema, permission: "optimization.manage" }, async (g) => {
  const supabase = await createClient();
  const values = { result_kind: g.resultKind, results_target: g.resultsTarget, spend_cents: g.spend, max_cost_cents: g.maxCost, min_roas: g.minRoas, notes: g.notes };
  const { data: existing } = await supabase.from("ad_goals").select("id").eq("client_id", g.clientId).eq("month", g.month).maybeSingle();
  if (existing) must(await supabase.from("ad_goals").update(values).eq("id", existing.id));
  else must(await supabase.from("ad_goals").insert({ client_id: g.clientId, month: g.month, ...values }));
  revalidatePath(`/clientes/${g.clientId}/anuncios`);
  return ok(null, "Meta do mês salva.");
});

export const deleteGoal = defineAction({ schema: goalIdSchema, permission: "optimization.manage" }, async ({ id, clientId }) => {
  const supabase = await createClient();
  must(await supabase.from("ad_goals").delete().eq("id", id));
  revalidatePath(`/clientes/${clientId}/anuncios`);
  return ok(null, "Meta apagada.");
});
