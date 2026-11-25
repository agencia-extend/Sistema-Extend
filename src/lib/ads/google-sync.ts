import "server-only";
import { googleAccountStatus } from "@/domain/integrations";
import { gaqlDate, googleAdStatus, googleInsight, googleObjective, googleStatus, microsToCents, type GoogleMetrics } from "@/domain/ads/google";
import { GoogleError, search } from "@/lib/integrations/google";
import { accessToken, getConnection, recordFailure } from "@/lib/integrations/store";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SyncCounts } from "./meta-sync";

// Sincronização de uma conta do Google Ads (RF-ADS-03/08): situação, campanhas, grupos de anúncios
// (gravados como conjuntos), anúncios e números por dia (conta, campanha, grupo e anúncio).
// Somente leitura no Google. Mesmas tabelas e janelas da Meta: 90 dias na primeira vez
// (37 por grupo e anúncio), depois os últimos 3 dias (o Google ainda ajusta as conversões).

const DAY = 86_400_000;
const FIRST_DAYS = 90;
const FIRST_AD_DAYS = 37;
const RECENT_DAYS = 3;

type AccountRow = { id: string; external_id: string; connection_id: string | null; synced_at: string | null; login_customer_id: string | null; name: string };

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

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

type Row = {
  customer?: { descriptiveName?: string; currencyCode?: string; timeZone?: string; status?: string };
  campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string; startDate?: string; endDate?: string };
  campaignBudget?: { amountMicros?: string; period?: string };
  adGroup?: { id?: string; name?: string; status?: string; type?: string; campaign?: string };
  adGroupAd?: { status?: string; ad?: { id?: string; name?: string; type?: string; finalUrls?: string[] }; policySummary?: { approvalStatus?: string } };
  segments?: { date?: string };
  metrics?: GoogleMetrics;
};

const METRICS = "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value";

/** Sincroniza uma conta. Lança GoogleError (já em português) se o Google recusar. */
export async function syncGoogleAccount(acc: AccountRow, token: string): Promise<SyncCounts> {
  const now = new Date().toISOString();
  const db = createAdminClient();
  const cid = acc.external_id.replace(/\D/g, "");
  const login = acc.login_customer_id ? acc.login_customer_id.replace(/\D/g, "") : null;
  const q = (query: string) => search<Row>(token, cid, query, login);

  // 1. Situação da conta.
  const [info] = await q("SELECT customer.descriptive_name, customer.currency_code, customer.time_zone, customer.status FROM customer LIMIT 1");
  await db.from("ad_accounts").update({
    name: info?.customer?.descriptiveName || acc.name,
    currency: info?.customer?.currencyCode ?? null,
    timezone: info?.customer?.timeZone ?? null,
    status_label: googleAccountStatus(info?.customer?.status),
    last_seen_at: now,
  }).eq("id", acc.id);

  // 2. Estrutura: campanhas → grupos de anúncios → anúncios.
  const camps = await q(
    "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.start_date, campaign.end_date, campaign_budget.amount_micros, campaign_budget.period FROM campaign WHERE campaign.status != 'REMOVED'",
  );
  const campIds = new Map(
    (await upsert("ad_campaigns", camps.filter((r) => r.campaign?.id).map((r) => {
      const c = r.campaign!;
      const daily = (r.campaignBudget?.period ?? "DAILY").toUpperCase() !== "CUSTOM_PERIOD";
      const budget = microsToCents(r.campaignBudget?.amountMicros);
      const status = googleStatus(c.status);
      return {
        ad_account_id: acc.id, external_id: String(c.id), name: c.name ?? `Campanha ${c.id}`, objective: googleObjective(c.advertisingChannelType),
        status, effective_status: status, daily_budget_cents: daily ? budget : null, lifetime_budget_cents: daily ? null : budget,
        starts_at: c.startDate ?? null, ends_at: c.endDate && !c.endDate.startsWith("2037") ? c.endDate : null, last_seen_at: now,
      };
    }), "ad_account_id,external_id", "id, external_id")).map((r) => [r.external_id, r.id]),
  );

  const groups = await q("SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.type, campaign.id FROM ad_group WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'");
  const setIds = new Map(
    (await upsert("ad_sets", groups.filter((r) => r.adGroup?.id).map((r) => ({
      ad_account_id: acc.id, campaign_id: campIds.get(String(r.campaign?.id)) ?? null, external_id: String(r.adGroup!.id), name: r.adGroup!.name ?? `Grupo ${r.adGroup!.id}`,
      effective_status: googleStatus(r.adGroup!.status), optimization_goal: r.adGroup!.type ?? null, daily_budget_cents: null, lifetime_budget_cents: null, last_seen_at: now,
    })), "ad_account_id,external_id", "id, external_id")).map((r) => [r.external_id, r.id]),
  );

  const ads = await q(
    "SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status, ad_group_ad.policy_summary.approval_status, ad_group.id, campaign.id FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED' AND campaign.status != 'REMOVED'",
  );
  await upsert("ads", ads.filter((r) => r.adGroupAd?.ad?.id).map((r) => {
    const a = r.adGroupAd!;
    const type = (a.ad?.type ?? "").replace(/_/g, " ").toLowerCase();
    return {
      ad_account_id: acc.id, campaign_id: campIds.get(String(r.campaign?.id)) ?? null, ad_set_id: setIds.get(String(r.adGroup?.id)) ?? null,
      external_id: String(a.ad!.id), name: a.ad!.name || `${type ? type[0].toUpperCase() + type.slice(1) : "Anúncio"} ${a.ad!.id}`,
      effective_status: googleAdStatus(a.status, a.policySummary?.approvalStatus), creative_external_id: null, thumbnail_url: null,
      review_feedback: (a.policySummary?.approvalStatus ?? "").toUpperCase() === "DISAPPROVED" ? "Reprovado pela política do Google Ads. Veja o motivo no Google Ads." : null,
      last_seen_at: now,
    };
  }), "ad_account_id,external_id");

  // 3. Números por dia.
  const until = gaqlDate(Date.now());
  const first = !acc.synced_at;
  let rows = 0;
  const levels = [
    ["account", "customer", "", first ? FIRST_DAYS : RECENT_DAYS],
    ["campaign", "campaign", "campaign.id, ", first ? FIRST_DAYS : RECENT_DAYS],
    ["adset", "ad_group", "ad_group.id, ", first ? FIRST_AD_DAYS : RECENT_DAYS],
    ["ad", "ad_group_ad", "ad_group_ad.ad.id, ", first ? FIRST_AD_DAYS : RECENT_DAYS],
  ] as const;
  for (const [level, from, idField, days] of levels) {
    const since = gaqlDate(Date.now() - (days - 1) * DAY);
    const res = await q(`SELECT ${idField}segments.date, ${METRICS} FROM ${from} WHERE segments.date BETWEEN '${since}' AND '${until}'`);
    const objectId = (r: Row) => (level === "account" ? acc.external_id : level === "campaign" ? r.campaign?.id : level === "adset" ? r.adGroup?.id : r.adGroupAd?.ad?.id);
    // Uma linha por objeto e dia (o Google pode repetir o dia quando há segmentos implícitos): soma.
    const merged = new Map<string, ReturnType<typeof googleInsight> & { object_external_id: string; date: string }>();
    for (const r of res) {
      const id = objectId(r);
      const date = r.segments?.date;
      if (!id || !date) continue;
      const m = googleInsight(r.metrics);
      const key = `${id}|${date}`;
      const prev = merged.get(key);
      if (!prev) merged.set(key, { object_external_id: String(id), date, ...m });
      else for (const k of Object.keys(m) as (keyof typeof m)[]) prev[k] += m[k];
    }
    await upsert("ad_insights_daily", [...merged.values()].map((v) => ({ ad_account_id: acc.id, level, ...v })), "ad_account_id,level,object_external_id,date");
    rows += merged.size;
  }

  // 4. Criativos da biblioteca com o código no nome do anúncio (CR-42) ficam ligados a ele (RF-BIB-03).
  const { error: le } = await db.rpc("sync_link_creatives", { p_account: acc.id });
  if (le) throw le;

  await db.from("ad_accounts").update({ synced_at: now, sync_error: null }).eq("id", acc.id);
  return { campaigns: camps.length, adSets: groups.length, ads: ads.length, insightRows: rows };
}

/** Sincroniza as contas ligadas do Google Ads, das mais atrasadas para as mais recentes, até o tempo acabar. */
export async function syncGoogleAccounts(opts: { trigger: "cron" | "manual"; accountIds?: string[]; budgetMs?: number }) {
  const db = createAdminClient();
  const started = Date.now();
  let q = db.from("ad_accounts").select("id, external_id, connection_id, synced_at, login_customer_id, name").eq("provider", "google").eq("is_enabled", true).not("connection_id", "is", null);
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
      if (!conn || conn.status !== "active") throw Object.assign(new GoogleError(), { message: "A conexão do Google Ads que encontrou esta conta está parada. Reconecte em Configurações › Integrações." });
      if (!tokens.has(conn.id)) tokens.set(conn.id, await accessToken(conn).catch((e: Error) => e));
      const token = tokens.get(conn.id)!;
      if (token instanceof Error) throw token;
      counts = await syncGoogleAccount(acc, token);
    } catch (e) {
      message = conn && e instanceof GoogleError ? (e.expired ? await recordFailure(conn, e) : e.message) : e instanceof GoogleError ? e.message : "Falha ao gravar os dados do Google Ads. Tente de novo.";
      if (!(e instanceof GoogleError)) console.error("[ads-sync google]", acc.id, (e as Error)?.message ?? e);
      await db.from("ad_accounts").update({ sync_error: message }).eq("id", acc.id);
    }
    if (run) await db.from("ad_sync_runs").update({ finished_at: new Date().toISOString(), ok: !message, error: message, counts: counts ?? {} }).eq("id", run.id);
    results.push({ account: acc.name, ok: !message, ...(message ? { error: message } : { counts }) });
  }
  return { total: accounts?.length ?? 0, done: results.length, results };
}
