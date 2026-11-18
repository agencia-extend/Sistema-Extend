import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kpis, resultKind, sumDays } from "@/domain/ads";
import { DEFAULT_REPORT_TEMPLATE, buildAdsReport, lastWeek, type ReportData, type ReportTopAd } from "@/domain/ads/report";
import { todayKey } from "@/domain/media";
import { getTrafficPanel } from "@/features/ads/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { getWhatsapp, sendAndLog, type StoredWhatsapp } from "./store";

type Db = SupabaseClient<Database>;

/** Grupo de relatórios da conexão (onde todos os relatórios chegam; o gestor encaminha a cada cliente). */
export async function reportsGroup(c: StoredWhatsapp) {
  const { data } = await createAdminClient().from("whatsapp_groups").select("jid, name").eq("connection_id", c.id).eq("is_reports", true).maybeSingle();
  return data;
}

/** Anúncio com o maior resultado no período (empate: o mais barato por resultado). Impressões não contam. */
async function topAd(db: Db, accountIds: string[], range: { start: string; end: string }): Promise<ReportTopAd | null> {
  if (!accountIds.length) return null;
  const [{ data: rows }, { data: ads }] = await Promise.all([
    db.from("ad_insights_daily").select("*").in("ad_account_id", accountIds).eq("level", "ad").gte("date", range.start).lte("date", range.end).limit(20000),
    db.from("ads").select("ad_account_id, external_id, name, ad_campaigns(objective)").in("ad_account_id", accountIds),
  ]);
  let best: ReportTopAd | null = null;
  for (const ad of ads ?? []) {
    const totals = sumDays((rows ?? []).filter((r) => r.ad_account_id === ad.ad_account_id && r.object_external_id === ad.external_id) as never);
    if (totals.spend_cents <= 0) continue;
    const camp = (Array.isArray(ad.ad_campaigns) ? ad.ad_campaigns[0] : ad.ad_campaigns) as { objective: string | null } | null;
    const kind = resultKind(camp?.objective, totals);
    if (kind === "impressions") continue;
    const k = kpis(totals, kind);
    if (k.results <= 0) continue;
    const better = !best || k.results > best.results || (k.results === best.results && (k.costPerResultCents ?? Infinity) < (best.costPerResultCents ?? Infinity));
    if (better) best = { name: ad.name, kind, results: k.results, costPerResultCents: k.costPerResultCents };
  }
  return best;
}

/**
 * Números do relatório de um cliente no período. Sem `db`, lê com o login da pessoa (a RLS decide o que ela vê);
 * o envio automático passa o cliente admin.
 */
export async function clientReportData(client: { id: string; name: string }, range: { start: string; end: string }, server?: { db: Db; organizationId: string }): Promise<ReportData> {
  const accounts = await getTrafficPanel(range, todayKey(new Date()), client.id, server);
  const db = server?.db ?? (await createClient());
  return { clientName: client.name, range, accounts, topAd: await topAd(db, accounts.map((a) => a.id), range) };
}

/** Modelo do cliente: o escolhido para ele, senão o padrão da agência, senão o do sistema. */
export async function clientTemplate(db: Db, organizationId: string, clientId: string): Promise<{ id: string | null; name: string; body: string }> {
  const { data: own } = await db.from("client_report_settings").select("report_templates(id, name, body)").eq("client_id", clientId).maybeSingle();
  const t = (Array.isArray(own?.report_templates) ? own.report_templates[0] : own?.report_templates) as { id: string; name: string; body: string } | null | undefined;
  if (t) return t;
  const { data: def } = await db.from("report_templates").select("id, name, body").eq("organization_id", organizationId).eq("is_default", true).maybeSingle();
  return def ?? { id: null, name: "Relatório padrão", body: DEFAULT_REPORT_TEMPLATE };
}

/** Monta o relatório de um cliente no período com o modelo dele. null = sem gasto. */
export async function clientReport(organizationId: string, client: { id: string; name: string }, range: { start: string; end: string }, templateBody?: string) {
  const db = createAdminClient();
  const [data, template] = await Promise.all([
    clientReportData(client, range, { db, organizationId }),
    templateBody ? Promise.resolve({ body: templateBody }) : clientTemplate(db, organizationId, client.id),
  ]);
  return buildAdsReport(data, template.body);
}

/**
 * Envia o relatório de um cliente para o grupo de relatórios. Devolve o erro em português ou null.
 * dedupeKey evita mandar duas vezes o automático da mesma semana.
 */
export async function sendClientReport(
  organizationId: string,
  client: { id: string; name: string },
  range: { start: string; end: string },
  opts: { createdBy?: string | null; dedupeKey?: string; templateBody?: string } = {},
) {
  const c = await getWhatsapp(organizationId);
  if (!c) return { error: "O WhatsApp da Extend ainda não foi configurado (Configurações › WhatsApp).", sent: false };
  const group = await reportsGroup(c);
  if (!group) return { error: "Marque o grupo de relatórios em Configurações › WhatsApp.", sent: false };
  const text = await clientReport(organizationId, client, range, opts.templateBody);
  if (!text) return { error: null, sent: false };
  const error = await sendAndLog(c, { kind: "relatorio", chatId: group.jid, chatName: group.name, body: text, dedupeKey: opts.dedupeKey, createdBy: opts.createdBy ?? null });
  return { error, sent: !error };
}

/** Toda segunda: relatório da semana anterior de cada cliente ativo com conta ligada, no grupo de relatórios. */
export async function sendWeeklyReports() {
  const db = createAdminClient();
  const range = lastWeek(todayKey(new Date()));
  const { data: accounts } = await db.from("ad_accounts").select("organization_id, client_id, clients!inner(name, status, deleted_at)").eq("is_enabled", true).not("client_id", "is", null);
  const clients = new Map<string, { org: string; name: string }>();
  for (const a of accounts ?? []) {
    const c = (Array.isArray(a.clients) ? a.clients[0] : a.clients) as { name: string; status: string; deleted_at: string | null } | null;
    if (c && !c.deleted_at && c.status === "ativo" && a.client_id) clients.set(a.client_id, { org: a.organization_id, name: c.name });
  }
  let sent = 0;
  const errors: string[] = [];
  for (const [id, c] of clients) {
    const r = await sendClientReport(c.org, { id, name: c.name }, range, { dedupeKey: `relatorio:${id}:${range.start}` });
    if (r.sent) sent++;
    if (r.error) errors.push(`${c.name}: ${r.error}`);
  }
  return { clients: clients.size, sent, errors: errors.slice(0, 10) };
}
