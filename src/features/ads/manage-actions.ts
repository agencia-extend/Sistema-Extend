"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import { changeEntry, type AdChange, type AdLevel } from "@/domain/ads/manage";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessToken, getConnection } from "@/lib/integrations/store";
import { MetaManageError, metaDuplicate, metaUpdate } from "@/lib/ads/meta-manage";
import { adBudgetSchema, adDuplicateSchema, adRenameSchema, adStatusSchema, campaignIdSchema } from "./schemas";

// Ajustes das campanhas da Meta (dia a dia). A pessoa precisa ser do tráfego do cliente e a conexão ter
// ads_management (o banco confere em ad_accounts_manageable e de novo em record_ad_change).

const TABLE = { campaign: "ad_campaigns", adset: "ad_sets", ad: "ads" } as const;
type Target = { id: string; accountId: string; externalId: string; name: string; dailyBudgetCents: number | null; clientId: string };

/** Lê o objeto com o login da pessoa (a RLS diz se ela vê) e confere se pode ajustar a conta. */
async function target(level: AdLevel, id: string): Promise<Target | string> {
  const supabase = await createClient();
  const cols = level === "ad" ? "id, ad_account_id, external_id, name" : "id, ad_account_id, external_id, name, daily_budget_cents";
  const { data } = await supabase.from(TABLE[level]).select(cols).eq("id", id).maybeSingle();
  const row = data as unknown as { id: string; ad_account_id: string; external_id: string; name: string; daily_budget_cents?: number | null } | null;
  if (!row) return "Não encontrado. Atualize a página.";
  const { data: ok } = await supabase.rpc("ad_accounts_manageable", { p_ids: [row.ad_account_id] });
  if (!((ok ?? []) as string[]).includes(row.ad_account_id))
    return "Você não pode ajustar esta conta pelo sistema (só o tráfego do cliente, com a conexão da Meta autorizada para alterar campanhas).";
  const { data: acc } = await supabase.from("ad_accounts").select("client_id").eq("id", row.ad_account_id).single();
  return {
    id: row.id, accountId: row.ad_account_id, externalId: row.external_id, name: row.name,
    dailyBudgetCents: row.daily_budget_cents == null ? null : Number(row.daily_budget_cents), clientId: acc!.client_id!,
  };
}

async function tokenFor(accountId: string): Promise<string> {
  const { data } = await createAdminClient().from("ad_accounts").select("connection_id").eq("id", accountId).single();
  const conn = data?.connection_id ? await getConnection(data.connection_id) : null;
  if (!conn) throw new MetaManageError("A conexão da Meta desta conta não foi encontrada. Reconecte em Configurações › Integrações.");
  return accessToken(conn);
}

/** Chama a Meta; deu certo → registra no histórico do cliente e atualiza as telas. */
async function apply(t: Target, change: AdChange, why: string | undefined, call: (token: string) => Promise<void>, local?: Record<string, unknown>, level?: AdLevel) {
  try {
    await call(await tokenFor(t.accountId));
  } catch (e) {
    if (e instanceof MetaManageError) return fail("business_rule", e.message);
    console.error("[ads-manage]", (e as Error)?.message ?? e);
    return fail("network", "Não foi possível falar com a Meta agora. Confira no Gerenciador antes de tentar de novo.");
  }
  if (local && level) await createAdminClient().from(TABLE[level]).update(local as never).eq("id", t.id);
  const entry = changeEntry(change);
  const supabase = await createClient();
  must(await supabase.rpc("record_ad_change", { p_account: t.accountId, p_category: entry.category, p_what: entry.what, p_why: why ?? "" }));
  revalidatePath("/trafego/painel");
  revalidatePath(`/clientes/${t.clientId}/anuncios`);
  revalidatePath(`/clientes/${t.clientId}/trafego`);
  return ok(null, entry.what.replace(" pelo sistema.", "."));
}

export const setAdStatus = defineAction({ schema: adStatusSchema, permission: "ads.manage" }, async ({ level, id, active, why }) => {
  const t = await target(level, id);
  if (typeof t === "string") return fail("forbidden", t);
  const status = active ? "ACTIVE" : "PAUSED";
  const local = level === "campaign" ? { status, effective_status: status } : { effective_status: status };
  return apply(t, { kind: "status", level, name: t.name, active }, why, (tk) => metaUpdate(tk, t.externalId, { status }), local, level);
});

export const setAdBudget = defineAction({ schema: adBudgetSchema, permission: "ads.manage" }, async ({ level, id, dailyBudget, why }) => {
  const t = await target(level, id);
  if (typeof t === "string") return fail("forbidden", t);
  if (t.dailyBudgetCents === null)
    return fail("business_rule", level === "campaign" ? "Esta campanha não tem orçamento diário na campanha: ajuste o orçamento de cada conjunto." : "Este conjunto não tem orçamento diário (o orçamento é da campanha ou vitalício).");
  if (t.dailyBudgetCents === dailyBudget) return fail("business_rule", "O orçamento já é este valor.");
  return apply(
    t,
    { kind: "budget", level, name: t.name, fromCents: t.dailyBudgetCents, toCents: dailyBudget },
    why,
    (tk) => metaUpdate(tk, t.externalId, { dailyBudgetCents: dailyBudget }),
    { daily_budget_cents: dailyBudget },
    level,
  );
});

export const renameAdObject = defineAction({ schema: adRenameSchema, permission: "ads.manage" }, async ({ level, id, name }) => {
  const t = await target(level, id);
  if (typeof t === "string") return fail("forbidden", t);
  if (t.name === name) return fail("business_rule", "O nome é o mesmo.");
  return apply(t, { kind: "rename", level, from: t.name, to: name }, undefined, (tk) => metaUpdate(tk, t.externalId, { name }), { name }, level);
});

export const duplicateAdObject = defineAction({ schema: adDuplicateSchema, permission: "ads.manage" }, async ({ level, id, why }) => {
  const t = await target(level, id);
  if (typeof t === "string") return fail("forbidden", t);
  return apply(t, { kind: "duplicate", level, name: t.name }, why, async (tk) => void (await metaDuplicate(tk, level, t.externalId)));
});

/** Conjuntos da campanha com orçamento diário (para ajustar quando o orçamento não é da campanha). */
export const listCampaignAdSets = defineAction({ schema: campaignIdSchema, permission: "ads.manage" }, async ({ campaignId }) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ad_sets").select("id, name, effective_status, daily_budget_cents").eq("campaign_id", campaignId).order("name");
  if (error) return fail("network", "Não foi possível carregar os conjuntos.");
  return ok(
    (data ?? []).map((s) => ({ id: s.id, name: s.name, status: s.effective_status, dailyBudgetCents: s.daily_budget_cents === null ? null : Number(s.daily_budget_cents) })),
  );
});

export type AdSetBudget = { id: string; name: string; status: string | null; dailyBudgetCents: number | null };
