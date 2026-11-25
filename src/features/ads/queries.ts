import "server-only";
import { daysLeft, kpis, resultKind, sumDays, type Kpis, type ResultKind, type Totals } from "@/domain/ads";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Leitura com o login da pessoa: a RLS (can_see_ad_account) mostra só as contas dos clientes que ela acessa.

export type CampaignRow = {
  id: string;
  externalId: string;
  name: string;
  objective: string | null;
  status: string | null;
  dailyBudgetCents: number | null;
  totals: Totals;
  kind: ResultKind;
  kpis: Kpis;
};

export type AccountPanel = {
  id: string;
  name: string;
  externalId: string;
  clientId: string | null;
  clientName: string | null;
  statusCode: number | null;
  isPrepay: boolean | null;
  fundsCents: number | null;
  fundingDisplay: string | null;
  daysLeft: number | null;
  syncedAt: string | null;
  syncError: string | null;
  totals: Totals;
  campaigns: CampaignRow[];
  /** A pessoa pode ajustar as campanhas desta conta pelo sistema (tráfego do cliente + conexão com ads_management). */
  canManage: boolean;
};

const n = (v: unknown) => Number(v ?? 0);

/** Painel do tráfego (RF-ADS-05): contas ligadas → campanhas, com os números do período. */
export async function getTrafficPanel(
  range: { start: string; end: string },
  today: string,
  clientId?: string,
  // Envio automático (sem pessoa logada): o servidor passa o cliente admin e a organização.
  server?: { db: SupabaseClient<Database>; organizationId: string },
): Promise<AccountPanel[]> {
  const supabase = server?.db ?? (await createClient());
  let q = supabase
    .from("ad_accounts")
    .select("id, name, external_id, client_id, account_status_code, is_prepay, funds_cents, funding_display, synced_at, sync_error, clients(name)")
    .eq("is_enabled", true);
  if (clientId) q = q.eq("client_id", clientId);
  if (server) q = q.eq("organization_id", server.organizationId);
  const { data: accounts, error } = await q;
  if (error) throw error;
  if (!accounts?.length) return [];
  const ids = accounts.map((a) => a.id);
  const seven = new Date(`${today}T12:00:00Z`);
  seven.setUTCDate(seven.getUTCDate() - 7);
  const from7 = seven.toISOString().slice(0, 10);

  const [{ data: camps }, { data: ins }, { data: acc7 }, { data: manageable }] = await Promise.all([
    supabase.from("ad_campaigns").select("id, ad_account_id, external_id, name, objective, effective_status, daily_budget_cents").in("ad_account_id", ids),
    supabase.from("ad_insights_daily").select("*").in("ad_account_id", ids).in("level", ["account", "campaign"]).gte("date", range.start).lte("date", range.end).limit(20000),
    // Gasto dos 7 dias completos antes de hoje, para a previsão do saldo.
    supabase.from("ad_insights_daily").select("ad_account_id, date, spend_cents").in("ad_account_id", ids).eq("level", "account").gte("date", from7).lt("date", today),
    // Envio automático (sem pessoa) não ajusta nada.
    server ? Promise.resolve({ data: [] as string[] }) : supabase.rpc("ad_accounts_manageable", { p_ids: ids }),
  ]);
  const canManage = new Set((manageable ?? []) as string[]);

  return accounts
    .map((a) => {
      const accRows = (ins ?? []).filter((r) => r.ad_account_id === a.id);
      const campaigns = (camps ?? [])
        .filter((c) => c.ad_account_id === a.id)
        .map((c) => {
          const totals = sumDays(accRows.filter((r) => r.level === "campaign" && r.object_external_id === c.external_id) as never);
          const kind = resultKind(c.objective, totals);
          return {
            id: c.id, externalId: c.external_id, name: c.name, objective: c.objective, status: c.effective_status,
            dailyBudgetCents: c.daily_budget_cents === null ? null : n(c.daily_budget_cents), totals, kind, kpis: kpis(totals, kind),
          };
        })
        // Só o que gastou no período ou está no ar agora.
        .filter((c) => c.totals.spend_cents > 0 || c.status === "ACTIVE")
        .sort((x, y) => y.totals.spend_cents - x.totals.spend_cents || x.name.localeCompare(y.name, "pt-BR"));
      const funds = a.funds_cents === null ? null : n(a.funds_cents);
      const client = (Array.isArray(a.clients) ? a.clients[0] : a.clients) as { name: string } | null;
      return {
        id: a.id, name: a.name, externalId: a.external_id, clientId: a.client_id, clientName: client?.name ?? null,
        statusCode: a.account_status_code, isPrepay: a.is_prepay, fundsCents: funds, fundingDisplay: a.funding_display,
        daysLeft: daysLeft(funds, (acc7 ?? []).filter((r) => r.ad_account_id === a.id).map((r) => n(r.spend_cents))),
        syncedAt: a.synced_at, syncError: a.sync_error,
        totals: sumDays(accRows.filter((r) => r.level === "account") as never),
        campaigns,
        canManage: canManage.has(a.id),
      };
    })
    .sort((x, y) => (x.clientName ?? "").localeCompare(y.clientName ?? "", "pt-BR") || x.name.localeCompare(y.name, "pt-BR"));
}

export type AdRow = {
  id: string;
  accountId: string;
  name: string;
  status: string | null;
  thumbnailUrl: string | null;
  reviewFeedback: string | null;
  campaignName: string | null;
  objective: string | null;
  totals: Totals;
  kind: ResultKind;
  kpis: Kpis;
};

/** Aba Anúncios do cliente (RF-ADS-07): o que está no ar ou rodou no período, com miniatura e números. */
export async function getClientAds(clientId: string, range: { start: string; end: string }): Promise<{ accounts: AccountPanel[]; ads: AdRow[] }> {
  const supabase = await createClient();
  const today = range.end;
  const accounts = await getTrafficPanel(range, today, clientId);
  if (!accounts.length) return { accounts, ads: [] };
  const ids = accounts.map((a) => a.id);
  const [{ data: ads }, { data: ins }] = await Promise.all([
    supabase.from("ads").select("id, ad_account_id, external_id, name, effective_status, thumbnail_url, review_feedback, ad_campaigns(name, objective)").in("ad_account_id", ids),
    supabase.from("ad_insights_daily").select("*").in("ad_account_id", ids).eq("level", "ad").gte("date", range.start).lte("date", range.end).limit(20000),
  ]);
  const rows = (ads ?? [])
    .map((a) => {
      const camp = (Array.isArray(a.ad_campaigns) ? a.ad_campaigns[0] : a.ad_campaigns) as { name: string; objective: string | null } | null;
      const totals = sumDays((ins ?? []).filter((r) => r.ad_account_id === a.ad_account_id && r.object_external_id === a.external_id) as never);
      const kind = resultKind(camp?.objective, totals);
      return {
        id: a.id, accountId: a.ad_account_id, name: a.name, status: a.effective_status, thumbnailUrl: a.thumbnail_url, reviewFeedback: a.review_feedback,
        campaignName: camp?.name ?? null, objective: camp?.objective ?? null, totals, kind, kpis: kpis(totals, kind),
      };
    })
    .filter((a) => a.totals.spend_cents > 0 || a.status === "ACTIVE" || a.status === "DISAPPROVED" || a.status === "WITH_ISSUES")
    .sort((x, y) => Number(y.status === "ACTIVE") - Number(x.status === "ACTIVE") || y.totals.spend_cents - x.totals.spend_cents);
  return { accounts, ads: rows };
}

export type ClientGoal = {
  id: string;
  month: string;
  resultKind: "leads" | "messages" | "purchases" | "link_clicks";
  resultsTarget: number | null;
  spendCents: number | null;
  maxCostCents: number | null;
  minRoas: number | null;
  notes: string | null;
};

/** Meta do mês do cliente e o realizado até ontem (contas ligadas, nível conta). */
export async function getClientGoal(clientId: string, today: string): Promise<{ goal: ClientGoal | null; actual: { spendCents: number; results: number; purchaseValueCents: number } }> {
  const supabase = await createClient();
  const month = `${today.slice(0, 7)}-01`;
  const [{ data: g }, { data: accs }] = await Promise.all([
    supabase.from("ad_goals").select("id, month, result_kind, results_target, spend_cents, max_cost_cents, min_roas, notes").eq("client_id", clientId).eq("month", month).maybeSingle(),
    supabase.from("ad_accounts").select("id").eq("client_id", clientId).eq("is_enabled", true),
  ]);
  const ids = (accs ?? []).map((a) => a.id);
  const { data: rows } = ids.length
    ? await supabase.from("ad_insights_daily").select("spend_cents, leads, messages, purchases, link_clicks, purchase_value_cents").in("ad_account_id", ids).eq("level", "account").gte("date", month).lt("date", today)
    : { data: [] };
  const kind = (g?.result_kind ?? "leads") as ClientGoal["resultKind"];
  const actual = { spendCents: 0, results: 0, purchaseValueCents: 0 };
  for (const r of rows ?? []) {
    actual.spendCents += n(r.spend_cents);
    actual.results += n(r[kind]);
    actual.purchaseValueCents += n(r.purchase_value_cents);
  }
  return {
    goal: g ? { id: g.id, month: g.month, resultKind: kind, resultsTarget: g.results_target, spendCents: g.spend_cents === null ? null : n(g.spend_cents), maxCostCents: g.max_cost_cents === null ? null : n(g.max_cost_cents), minRoas: g.min_roas === null ? null : Number(g.min_roas), notes: g.notes } : null,
    actual,
  };
}
