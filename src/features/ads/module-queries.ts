import "server-only";
import { cache } from "react";
import { daysLeft, emptyTotals, kpis, resultKind, sumDays, type Kpis, type ResultKind, type Totals } from "@/domain/ads";
import { groupKey, groupLabel, periodGroups, statusMatches, type AdsFilters } from "@/domain/ads/filters";
import { createClient } from "@/lib/supabase/server";

// Módulo Anúncios (como no HubSystem): leitura com o login da pessoa; a RLS mostra só as contas dos clientes dela.

export type ModuleAccount = {
  id: string; name: string; clientId: string | null; clientName: string | null; isPrepay: boolean | null; fundsCents: number | null;
  fundingDisplay: string | null; daysLeft: number | null; statusCode: number | null; syncedAt: string | null; syncError: string | null; canManage: boolean;
};
export type ModuleCampaign = {
  id: string; externalId: string; name: string; objective: string | null; status: string | null; dailyBudgetCents: number | null;
  accountId: string; accountName: string; clientId: string | null; clientName: string | null; canManage: boolean;
  totals: Totals; kind: ResultKind; kpis: Kpis;
};

/** Resultados que interessam ao cliente: leads + conversas + compras. */
export const resultsOf = (t: Totals) => t.leads + t.messages + t.purchases;

const n = (v: unknown) => Number(v ?? 0);

/** Contas que a pessoa vê (Meta e Google Ads, incluídas no sistema), com saldo e previsão. Cache por requisição. */
export const getModuleAccounts = cache(async (today: string): Promise<ModuleAccount[]> => {
  const supabase = await createClient();
  const { data: accounts, error } = await supabase
    .from("ad_accounts")
    .select("id, name, client_id, account_status_code, is_prepay, funds_cents, funding_display, synced_at, sync_error, clients(name)")
    .eq("is_enabled", true);
  if (error) throw error;
  if (!accounts?.length) return [];
  const ids = accounts.map((a) => a.id);
  const seven = new Date(Date.parse(`${today}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: acc7 }, { data: manageable }] = await Promise.all([
    supabase.from("ad_insights_daily").select("ad_account_id, spend_cents").in("ad_account_id", ids).eq("level", "account").gte("date", seven).lt("date", today),
    supabase.rpc("ad_accounts_manageable", { p_ids: ids }),
  ]);
  const can = new Set((manageable ?? []) as string[]);
  return accounts
    .map((a) => {
      const client = (Array.isArray(a.clients) ? a.clients[0] : a.clients) as { name: string } | null;
      const funds = a.funds_cents === null ? null : n(a.funds_cents);
      return {
        id: a.id, name: a.name, clientId: a.client_id, clientName: client?.name ?? null, isPrepay: a.is_prepay, fundsCents: funds, fundingDisplay: a.funding_display,
        daysLeft: daysLeft(funds, (acc7 ?? []).filter((r) => r.ad_account_id === a.id).map((r) => n(r.spend_cents))),
        statusCode: a.account_status_code, syncedAt: a.synced_at, syncError: a.sync_error, canManage: can.has(a.id),
      };
    })
    .sort((x, y) => (x.clientName ?? "").localeCompare(y.clientName ?? "", "pt-BR") || x.name.localeCompare(y.name, "pt-BR"));
});

/** Contas dentro dos filtros de cliente e conta. */
export const scopedAccounts = (accounts: ModuleAccount[], f: AdsFilters) =>
  accounts.filter((a) => (!f.clientId || a.clientId === f.clientId) && (!f.accountId || a.id === f.accountId));

/** Visão geral: totais do período e do anterior, série do gráfico e as campanhas. */
export async function getAdsReport(f: AdsFilters, today: string) {
  const supabase = await createClient();
  const accounts = scopedAccounts(await getModuleAccounts(today), f);
  if (!accounts.length) return { accounts, totals: emptyTotals(), previous: emptyTotals(), series: [], campaigns: [] as ModuleCampaign[] };
  const ids = accounts.map((a) => a.id);
  const [{ data: acc }, { data: camps }, { data: campIns }] = await Promise.all([
    supabase.from("ad_insights_daily").select("*").in("ad_account_id", ids).eq("level", "account").gte("date", f.prevFrom).lte("date", f.to).limit(20000),
    supabase.from("ad_campaigns").select("id, ad_account_id, external_id, name, objective, effective_status, daily_budget_cents").in("ad_account_id", ids),
    supabase.from("ad_insights_daily").select("*").in("ad_account_id", ids).eq("level", "campaign").gte("date", f.from).lte("date", f.to).limit(20000),
  ]);
  const byAcc = new Map(accounts.map((a) => [a.id, a]));
  // Com filtro de status, os totais saem das campanhas filtradas; sem ele, da conta (inclui o que já foi apagado).
  const campaigns = (camps ?? [])
    .filter((c) => statusMatches(c.effective_status, f.status))
    .map((c): ModuleCampaign => {
      const a = byAcc.get(c.ad_account_id)!;
      const totals = sumDays((campIns ?? []).filter((r) => r.ad_account_id === c.ad_account_id && r.object_external_id === c.external_id) as never);
      const kind = resultKind(c.objective, totals);
      return {
        id: c.id, externalId: c.external_id, name: c.name, objective: c.objective, status: c.effective_status,
        dailyBudgetCents: c.daily_budget_cents === null ? null : n(c.daily_budget_cents), accountId: a.id, accountName: a.name,
        clientId: a.clientId, clientName: a.clientName, canManage: a.canManage, totals, kind, kpis: kpis(totals, kind),
      };
    })
    .filter((c) => c.totals.spend_cents > 0 || c.status === "ACTIVE")
    .sort((x, y) => y.totals.spend_cents - x.totals.spend_cents || x.name.localeCompare(y.name, "pt-BR"));

  const inRange = (d: string, from: string, to: string) => d >= from && d <= to;
  const rows = acc ?? [];
  const totals = f.status ? sumTotals(campaigns.map((c) => c.totals)) : sumDays(rows.filter((r) => inRange(r.date, f.from, f.to)) as never);
  const previous = sumDays(rows.filter((r) => inRange(r.date, f.prevFrom, f.prevTo)) as never);
  const groups = periodGroups(f.from, f.to, f.group);
  const series = groups.map((g) => {
    const t = sumDays(rows.filter((r) => inRange(r.date, f.from, f.to) && groupKey(r.date, f.group) === g) as never);
    return { period: groupLabel(g, f.group), spend: t.spend_cents, results: resultsOf(t), clicks: t.link_clicks || t.clicks };
  });
  return { accounts, totals, previous, series, campaigns };
}

function sumTotals(list: Totals[]): Totals {
  const out = emptyTotals();
  for (const t of list) for (const k of Object.keys(out) as (keyof Totals)[]) out[k] += t[k];
  return out;
}

export type ClientSummary = {
  clientId: string | null; clientName: string; accounts: ModuleAccount[]; totals: Totals; previousSpendCents: number;
  results: number; costPerResultCents: number | null; activeCampaigns: number; openAlerts: number;
};

/** Aba Clientes: um resumo por cliente (gasto, resultados, custo, saldo, campanhas no ar e alertas abertos). */
export async function getClientsSummary(f: AdsFilters, today: string): Promise<ClientSummary[]> {
  const supabase = await createClient();
  const report = await getAdsReport({ ...f, status: undefined }, today);
  if (!report.accounts.length) return [];
  const ids = report.accounts.map((a) => a.id);
  const [{ data: prev }, { data: alerts }] = await Promise.all([
    supabase.from("ad_insights_daily").select("ad_account_id, spend_cents").in("ad_account_id", ids).eq("level", "account").gte("date", f.prevFrom).lte("date", f.prevTo).limit(20000),
    supabase.from("ad_alerts").select("client_id").eq("status", "aberto"),
  ]);
  const { data: cur } = await supabase.from("ad_insights_daily").select("*").in("ad_account_id", ids).eq("level", "account").gte("date", f.from).lte("date", f.to).limit(20000);
  const groups = new Map<string, ClientSummary>();
  for (const a of report.accounts) {
    const key = a.clientId ?? `conta:${a.id}`;
    const g = groups.get(key) ?? { clientId: a.clientId, clientName: a.clientName ?? a.name, accounts: [], totals: emptyTotals(), previousSpendCents: 0, results: 0, costPerResultCents: null, activeCampaigns: 0, openAlerts: 0 };
    g.accounts.push(a);
    g.totals = sumTotals([g.totals, sumDays((cur ?? []).filter((r) => r.ad_account_id === a.id) as never)]);
    g.previousSpendCents += (prev ?? []).filter((r) => r.ad_account_id === a.id).reduce((s, r) => s + n(r.spend_cents), 0);
    groups.set(key, g);
  }
  for (const c of report.campaigns) {
    const g = groups.get(c.clientId ?? `conta:${c.accountId}`);
    if (g && c.status === "ACTIVE") g.activeCampaigns++;
  }
  for (const g of groups.values()) {
    g.results = resultsOf(g.totals);
    g.costPerResultCents = g.results > 0 ? Math.round(g.totals.spend_cents / g.results) : null;
    g.openAlerts = (alerts ?? []).filter((x) => x.client_id && x.client_id === g.clientId).length;
  }
  return [...groups.values()].sort((x, y) => y.totals.spend_cents - x.totals.spend_cents || x.clientName.localeCompare(y.clientName, "pt-BR"));
}

export type ModuleAd = {
  id: string; name: string; status: string | null; thumbnailUrl: string | null; reviewFeedback: string | null; campaignName: string | null;
  accountName: string; clientId: string | null; clientName: string | null; totals: Totals; kind: ResultKind; kpis: Kpis;
};

/** Aba Anúncios: o que rodou no período ou está no ar (ou reprovado), com miniatura e números. */
export async function getModuleAds(f: AdsFilters, today: string): Promise<ModuleAd[]> {
  const supabase = await createClient();
  const accounts = scopedAccounts(await getModuleAccounts(today), f);
  if (!accounts.length) return [];
  const ids = accounts.map((a) => a.id);
  const byAcc = new Map(accounts.map((a) => [a.id, a]));
  const [{ data: ads }, { data: ins }] = await Promise.all([
    supabase.from("ads").select("id, ad_account_id, external_id, name, effective_status, thumbnail_url, review_feedback, ad_campaigns(name, objective)").in("ad_account_id", ids),
    supabase.from("ad_insights_daily").select("*").in("ad_account_id", ids).eq("level", "ad").gte("date", f.from).lte("date", f.to).limit(20000),
  ]);
  return (ads ?? [])
    .filter((a) => statusMatches(a.effective_status, f.status))
    .map((a) => {
      const acc = byAcc.get(a.ad_account_id)!;
      const camp = (Array.isArray(a.ad_campaigns) ? a.ad_campaigns[0] : a.ad_campaigns) as { name: string; objective: string | null } | null;
      const totals = sumDays((ins ?? []).filter((r) => r.ad_account_id === a.ad_account_id && r.object_external_id === a.external_id) as never);
      const kind = resultKind(camp?.objective, totals);
      return {
        id: a.id, name: a.name, status: a.effective_status, thumbnailUrl: a.thumbnail_url, reviewFeedback: a.review_feedback, campaignName: camp?.name ?? null,
        accountName: acc.name, clientId: acc.clientId, clientName: acc.clientName, totals, kind, kpis: kpis(totals, kind),
      };
    })
    .filter((a) => a.totals.spend_cents > 0 || a.status === "ACTIVE" || a.status === "DISAPPROVED" || a.status === "WITH_ISSUES")
    .sort((x, y) => y.totals.spend_cents - x.totals.spend_cents || x.name.localeCompare(y.name, "pt-BR"))
    .slice(0, 300);
}

export type ModuleAdSet = {
  id: string; name: string; status: string | null; optimizationGoal: string | null; dailyBudgetCents: number | null; lifetimeBudgetCents: number | null;
  campaignName: string | null; accountName: string; clientId: string | null; clientName: string | null; totals: Totals; kind: ResultKind; kpis: Kpis;
};

/** Aba Conjuntos: conjuntos no ar ou com gasto no período, com orçamento, campanha e números (nível "adset"). */
export async function getModuleAdSets(f: AdsFilters, today: string): Promise<{ sets: ModuleAdSet[]; hasData: boolean }> {
  const supabase = await createClient();
  const accounts = scopedAccounts(await getModuleAccounts(today), f);
  if (!accounts.length) return { sets: [], hasData: false };
  const ids = accounts.map((a) => a.id);
  const byAcc = new Map(accounts.map((a) => [a.id, a]));
  const [{ data: sets }, { data: ins }, { count }] = await Promise.all([
    supabase.from("ad_sets").select("id, ad_account_id, external_id, name, effective_status, optimization_goal, daily_budget_cents, lifetime_budget_cents, ad_campaigns(name, objective)").in("ad_account_id", ids),
    supabase.from("ad_insights_daily").select("*").in("ad_account_id", ids).eq("level", "adset").gte("date", f.from).lte("date", f.to).limit(20000),
    supabase.from("ad_insights_daily").select("id", { count: "exact", head: true }).in("ad_account_id", ids).eq("level", "adset"),
  ]);
  const rows = (sets ?? [])
    .filter((s) => statusMatches(s.effective_status, f.status))
    .map((s): ModuleAdSet => {
      const a = byAcc.get(s.ad_account_id)!;
      const camp = (Array.isArray(s.ad_campaigns) ? s.ad_campaigns[0] : s.ad_campaigns) as { name: string; objective: string | null } | null;
      const totals = sumDays((ins ?? []).filter((r) => r.ad_account_id === s.ad_account_id && r.object_external_id === s.external_id) as never);
      const kind = resultKind(camp?.objective, totals);
      return {
        id: s.id, name: s.name, status: s.effective_status, optimizationGoal: s.optimization_goal,
        dailyBudgetCents: s.daily_budget_cents === null ? null : n(s.daily_budget_cents), lifetimeBudgetCents: s.lifetime_budget_cents === null ? null : n(s.lifetime_budget_cents),
        campaignName: camp?.name ?? null, accountName: a.name, clientId: a.clientId, clientName: a.clientName, totals, kind, kpis: kpis(totals, kind),
      };
    })
    .filter((s) => s.totals.spend_cents > 0 || s.status === "ACTIVE")
    .sort((x, y) => y.totals.spend_cents - x.totals.spend_cents || x.name.localeCompare(y.name, "pt-BR"));
  return { sets: rows, hasData: (count ?? 0) > 0 };
}
