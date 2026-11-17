import "server-only";
import { centsOrNull, parseInsight, prepaidFundsCents, type InsightRow } from "@/domain/ads";
import { MetaError, all, get, graph, tk } from "@/lib/integrations/meta";
import { accessToken, getConnection, recordFailure } from "@/lib/integrations/store";
import { createAdminClient } from "@/lib/supabase/admin";

// Sincronização de uma conta de anúncio da Meta (RF-ADS-03/04): situação e saldo, campanhas, conjuntos,
// anúncios e números por dia (conta, campanha e anúncio). Somente leitura na Meta.

const DAY = 86_400_000;
const FIRST_DAYS = 90; // primeira sincronização: 90 dias de conta e campanha
const FIRST_AD_DAYS = 37; // e 37 dias por anúncio (cobre "este mês" e "30 dias")
const RECENT_DAYS = 3; // depois: os últimos 3 dias (a Meta ainda ajusta a atribuição)

type AccountRow = { id: string; external_id: string; connection_id: string | null; synced_at: string | null; organization_id: string; client_id: string | null; name: string };

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export type SyncCounts = { campaigns: number; adSets: number; ads: number; insightRows: number };

async function upsert(table: string, rows: Record<string, unknown>[], onConflict: string, select?: string) {
  const db = createAdminClient();
  const out: Record<string, string>[] = [];
  for (const part of chunk(rows, 500)) {
    const q = db.from(table as "ads").upsert(part as never, { onConflict });
    const { data, error } = select ? await q.select(select) : await q;
    if (error) throw error;
    if (data) out.push(...(data as unknown as Record<string, string>[]));
  }
  return out;
}

/** Sincroniza uma conta. Lança MetaError (já em português) se a Meta recusar. */
export async function syncMetaAccount(acc: AccountRow, token: string): Promise<SyncCounts> {
  const now = new Date().toISOString();
  const db = createAdminClient();

  // 1. Situação e saldo.
  const info = await get<{
    account_status?: number; disable_reason?: number; timezone_name?: string; is_prepay_account?: boolean; balance?: string;
    amount_spent?: string; spend_cap?: string; funding_source_details?: { display_string?: string }; name?: string;
  }>(graph(`/${acc.external_id}?fields=name,account_status,disable_reason,timezone_name,is_prepay_account,balance,amount_spent,spend_cap,funding_source_details&${tk(token)}`));
  const display = info.funding_source_details?.display_string ?? null;
  await db.from("ad_accounts").update({
    name: info.name ?? acc.name,
    account_status_code: info.account_status ?? null,
    disable_reason: info.disable_reason ?? null,
    timezone: info.timezone_name ?? null,
    is_prepay: info.is_prepay_account ?? null,
    balance_cents: centsOrNull(info.balance),
    funds_cents: info.is_prepay_account ? prepaidFundsCents(display) : null,
    funding_display: display,
    amount_spent_cents: centsOrNull(info.amount_spent),
    spend_cap_cents: centsOrNull(info.spend_cap) || null,
    last_seen_at: now,
  }).eq("id", acc.id);

  // 2. Estrutura: campanhas → conjuntos → anúncios.
  type C = { id: string; name: string; objective?: string; status?: string; effective_status?: string; daily_budget?: string; lifetime_budget?: string; start_time?: string; stop_time?: string };
  const camps = await all<C>(graph(`/${acc.external_id}/campaigns?fields=id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time&limit=200&${tk(token)}`));
  const campIds = new Map(
    (await upsert("ad_campaigns", camps.map((c) => ({
      ad_account_id: acc.id, external_id: c.id, name: c.name, objective: c.objective ?? null, status: c.status ?? null, effective_status: c.effective_status ?? null,
      daily_budget_cents: centsOrNull(c.daily_budget), lifetime_budget_cents: centsOrNull(c.lifetime_budget),
      starts_at: c.start_time ?? null, ends_at: c.stop_time ?? null, last_seen_at: now,
    })), "ad_account_id,external_id", "id, external_id")).map((r) => [r.external_id, r.id]),
  );

  type S = { id: string; name: string; campaign_id: string; effective_status?: string; optimization_goal?: string; daily_budget?: string; lifetime_budget?: string };
  const sets = await all<S>(graph(`/${acc.external_id}/adsets?fields=id,name,campaign_id,effective_status,optimization_goal,daily_budget,lifetime_budget&limit=200&${tk(token)}`));
  const setIds = new Map(
    (await upsert("ad_sets", sets.map((s) => ({
      ad_account_id: acc.id, campaign_id: campIds.get(s.campaign_id) ?? null, external_id: s.id, name: s.name, effective_status: s.effective_status ?? null,
      optimization_goal: s.optimization_goal ?? null, daily_budget_cents: centsOrNull(s.daily_budget), lifetime_budget_cents: centsOrNull(s.lifetime_budget), last_seen_at: now,
    })), "ad_account_id,external_id", "id, external_id")).map((r) => [r.external_id, r.id]),
  );

  type A = { id: string; name: string; campaign_id: string; adset_id: string; effective_status?: string; creative?: { id: string; thumbnail_url?: string }; ad_review_feedback?: { global?: Record<string, string> } };
  const ads = await all<A>(graph(`/${acc.external_id}/ads?fields=id,name,campaign_id,adset_id,effective_status,creative{id,thumbnail_url},ad_review_feedback&limit=200&${tk(token)}`));
  await upsert("ads", ads.map((a) => ({
    ad_account_id: acc.id, campaign_id: campIds.get(a.campaign_id) ?? null, ad_set_id: setIds.get(a.adset_id) ?? null, external_id: a.id, name: a.name,
    effective_status: a.effective_status ?? null, creative_external_id: a.creative?.id ?? null, thumbnail_url: a.creative?.thumbnail_url ?? null,
    review_feedback: a.ad_review_feedback?.global ? Object.entries(a.ad_review_feedback.global).map(([k, v]) => `${k}: ${v}`).join(" · ").slice(0, 2000) : null,
    last_seen_at: now,
  })), "ad_account_id,external_id");

  // 3. Números por dia.
  const until = day(Date.now());
  const first = !acc.synced_at;
  let rows = 0;
  const fields = "date_start,campaign_id,ad_id,spend,impressions,reach,clicks,actions,action_values,video_thruplay_watched_actions";
  for (const [level, days] of [["account", first ? FIRST_DAYS : RECENT_DAYS], ["campaign", first ? FIRST_DAYS : RECENT_DAYS], ["ad", first ? FIRST_AD_DAYS : RECENT_DAYS]] as const) {
    const since = day(Date.now() - (days - 1) * DAY);
    const range = encodeURIComponent(JSON.stringify({ since, until }));
    const ins = await all<InsightRow & { campaign_id?: string; ad_id?: string }>(
      graph(`/${acc.external_id}/insights?level=${level}&time_increment=1&time_range=${range}&fields=${fields}&limit=500&${tk(token)}`),
      50_000,
    );
    await upsert("ad_insights_daily", ins.map((r) => {
      const { date, ...m } = parseInsight(r);
      return { ad_account_id: acc.id, level, object_external_id: level === "account" ? acc.external_id : level === "campaign" ? r.campaign_id! : r.ad_id!, date, ...m };
    }), "ad_account_id,level,object_external_id,date");
    rows += ins.length;
  }

  // 4. Frequência dos últimos 7 dias completos por anúncio (fadiga de criativo). A Meta calcula com o alcance único;
  //    só vêm os anúncios com entrega no período (conferido com a conta real: 0 linhas numa conta parada).
  const freq = await all<{ ad_id: string; impressions?: string; frequency?: string }>(
    graph(`/${acc.external_id}/insights?level=ad&date_preset=last_7d&fields=ad_id,impressions,frequency&limit=500&${tk(token)}`),
    5_000,
  );
  const { error: fe } = await db.rpc("set_ad_frequency", {
    p_account: acc.id,
    p_rows: freq.filter((f) => f.ad_id && f.frequency).map((f) => ({ ad_id: f.ad_id, frequency: Number(f.frequency), impressions: Number(f.impressions ?? 0) })),
  });
  if (fe) throw fe;

  // 5. Criativos da biblioteca com o código no nome do anúncio (CR-42) ficam ligados a ele (RF-BIB-03).
  const { error: le } = await db.rpc("sync_link_creatives", { p_account: acc.id });
  if (le) throw le;

  await db.from("ad_accounts").update({ synced_at: now, sync_error: null }).eq("id", acc.id);
  return { campaigns: camps.length, adSets: sets.length, ads: ads.length, insightRows: rows };
}

/**
 * Sincroniza as contas ligadas da Meta, das mais atrasadas para as mais recentes, até o tempo acabar.
 * accountIds limita a algumas contas ("Sincronizar agora").
 */
export async function syncMetaAccounts(opts: { trigger: "cron" | "manual"; accountIds?: string[]; budgetMs?: number }) {
  const db = createAdminClient();
  const started = Date.now();
  let q = db.from("ad_accounts").select("id, external_id, connection_id, synced_at, organization_id, client_id, name").eq("provider", "meta").eq("is_enabled", true).not("connection_id", "is", null);
  if (opts.accountIds) q = q.in("id", opts.accountIds);
  const { data: accounts, error } = await q.order("synced_at", { ascending: true, nullsFirst: true });
  if (error) throw error;
  const results: { account: string; ok: boolean; error?: string; counts?: SyncCounts }[] = [];
  const tokens = new Map<string, string | Error>();

  for (const acc of accounts ?? []) {
    if (Date.now() - started > (opts.budgetMs ?? 45_000)) break;
    const { data: run } = await db.from("ad_sync_runs").insert({ ad_account_id: acc.id, trigger: opts.trigger }).select("id").single();
    let message: string | null = null;
    let counts: SyncCounts | undefined;
    const conn = await getConnection(acc.connection_id!);
    try {
      if (!conn || conn.status !== "active") throw Object.assign(new MetaError(), { message: "A conexão que encontrou esta conta está parada. Reconecte em Configurações › Integrações." });
      if (!tokens.has(conn.id)) tokens.set(conn.id, await accessToken(conn).catch((e: Error) => e));
      const token = tokens.get(conn.id)!;
      if (token instanceof Error) throw token;
      counts = await syncMetaAccount(acc, token);
    } catch (e) {
      message = conn && (e instanceof MetaError) ? (e.expired ? await recordFailure(conn, e) : e.message) : e instanceof MetaError ? e.message : "Falha ao gravar os dados da Meta. Tente de novo.";
      if (!(e instanceof MetaError)) console.error("[ads-sync]", acc.id, (e as Error)?.message ?? e);
      await db.from("ad_accounts").update({ sync_error: message }).eq("id", acc.id);
    }
    if (run) await db.from("ad_sync_runs").update({ finished_at: new Date().toISOString(), ok: !message, error: message, counts: counts ?? {} }).eq("id", run.id);
    results.push({ account: acc.name, ok: !message, ...(message ? { error: message } : { counts }) });
  }
  return { total: accounts?.length ?? 0, done: results.length, results };
}
