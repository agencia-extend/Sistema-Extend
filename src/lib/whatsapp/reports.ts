import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kpis, resultKind, sumDays } from "@/domain/ads";
import {
  DEFAULT_REPORT_TEMPLATE,
  DEFAULT_SCHEDULE,
  buildAdsReport,
  scheduleDue,
  scheduleKey,
  scheduleRange,
  spClock,
  type ReportData,
  type ReportFrequency,
  type ReportTopAd,
} from "@/domain/ads/report";
import { formatDateTime } from "@/domain/shared/dates";
import { renderAdsReportPdf } from "@/features/ads/pdf/ads-report-pdf";
import { todayKey } from "@/domain/media";
import { getTrafficPanel } from "@/features/ads/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { getWhatsapp, sendAndLog, wahaConn, type StoredWhatsapp } from "./store";
import { WahaError, wahaSendMedia } from "./waha";

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

/** Monta o relatório de um cliente no período com o modelo dele. text null = sem gasto. */
export async function clientReport(organizationId: string, client: { id: string; name: string }, range: { start: string; end: string }, templateBody?: string) {
  const db = createAdminClient();
  const [data, template] = await Promise.all([
    clientReportData(client, range, { db, organizationId }),
    templateBody ? Promise.resolve({ body: templateBody }) : clientTemplate(db, organizationId, client.id),
  ]);
  return { text: buildAdsReport(data, template.body), data };
}

const slug = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "cliente";
export const reportFileName = (clientName: string, range: { start: string; end: string }) => `relatorio-anuncios-${slug(clientName)}-${range.start}-a-${range.end}.pdf`;

/**
 * RF-REL-06: guarda o PDF do relatório enviado (um por cliente e período; reenviar substitui) para a aba
 * Relatórios do cliente. Devolve o caminho no armazenamento ou null se não deu para guardar.
 */
export async function archiveReportPdf(organizationId: string, clientId: string, data: ReportData, frequency: Exclude<ReportFrequency, "desligado"> | "avulso", sentBy: string | null) {
  const db = createAdminClient();
  const pdf = await renderAdsReportPdf(data, formatDateTime(new Date()));
  const path = `${organizationId}/${clientId}/${data.range.start}_${data.range.end}.pdf`;
  const up = await db.storage.from("relatorios").upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (up.error) {
    console.error("[relatorios] upload do PDF", up.error.message);
    return null;
  }
  const { error } = await db.from("ads_report_files").upsert(
    { organization_id: organizationId, client_id: clientId, period_start: data.range.start, period_end: data.range.end, frequency, storage_path: path, size_bytes: pdf.length, sent_by: sentBy, sent_at: new Date().toISOString() },
    { onConflict: "client_id,period_start,period_end" },
  );
  if (error) {
    console.error("[relatorios] registro do PDF", error.message);
    return null;
  }
  return path;
}

/**
 * Envia o relatório de um cliente para o grupo de relatórios: o texto e, logo abaixo, o PDF (para encaminhar ao
 * cliente). O PDF fica guardado na aba Relatórios. Devolve o erro em português ou null.
 * dedupeKey evita mandar duas vezes o automático do mesmo período.
 */
export async function sendClientReport(
  organizationId: string,
  client: { id: string; name: string },
  range: { start: string; end: string },
  opts: { createdBy?: string | null; dedupeKey?: string; templateBody?: string; frequency?: Exclude<ReportFrequency, "desligado"> | "avulso" } = {},
) {
  const c = await getWhatsapp(organizationId);
  if (!c) return { error: "O WhatsApp da Extend ainda não foi configurado (Configurações › WhatsApp).", sent: false, pdfError: null };
  const group = await reportsGroup(c);
  if (!group) return { error: "Marque o grupo de relatórios em Configurações › WhatsApp.", sent: false, pdfError: null };
  const { text, data } = await clientReport(organizationId, client, range, opts.templateBody);
  if (!text) return { error: null, sent: false, pdfError: null };
  const error = await sendAndLog(c, { kind: "relatorio", chatId: group.jid, chatName: group.name, body: text, dedupeKey: opts.dedupeKey, createdBy: opts.createdBy ?? null });
  if (error) return { error, sent: false, pdfError: null };

  // O texto já foi: falha no PDF não desfaz o envio, só avisa.
  let pdfError: string | null = null;
  const path = await archiveReportPdf(organizationId, client.id, data, opts.frequency ?? "avulso", opts.createdBy ?? null);
  if (!path) pdfError = "O relatório foi enviado, mas o PDF não foi guardado. Baixe pelo botão Relatório.";
  else {
    try {
      const { data: signed } = await createAdminClient().storage.from("relatorios").createSignedUrl(path, 3600);
      if (!signed?.signedUrl) throw new WahaError("link");
      await wahaSendMedia(wahaConn(c), group.jid, { url: signed.signedUrl, mime: "application/pdf", name: reportFileName(client.name, range), kind: "document" });
    } catch {
      pdfError = "O texto foi enviado, mas o PDF não chegou ao grupo. Ele está na aba Relatórios do cliente.";
    }
  }
  return { error: null, sent: true, pdfError };
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * De hora em hora (RF-REL-01): manda o relatório de cada cliente ativo com conta ligada cuja frequência cai hoje e
 * cujo horário já chegou (padrão: segunda às 9h, semana passada). Um por vez, com intervalo entre os envios; o que
 * não couber no tempo sai na próxima hora.
 */
export async function sendScheduledReports(opts: { now?: Date; budgetMs?: number; gapMs?: number } = {}) {
  const started = Date.now();
  const budget = opts.budgetMs ?? 45_000;
  const gap = opts.gapMs ?? 3_000;
  const clock = spClock(opts.now ?? new Date());
  const db = createAdminClient();
  const { data: accounts } = await db.from("ad_accounts").select("organization_id, client_id, clients!inner(name, status, deleted_at)").eq("is_enabled", true).not("client_id", "is", null);
  const clients = new Map<string, { org: string; name: string }>();
  for (const a of accounts ?? []) {
    const c = (Array.isArray(a.clients) ? a.clients[0] : a.clients) as { name: string; status: string; deleted_at: string | null } | null;
    if (c && !c.deleted_at && c.status === "ativo" && a.client_id) clients.set(a.client_id, { org: a.organization_id, name: c.name });
  }
  const { data: settings } = clients.size
    ? await db.from("client_report_settings").select("client_id, frequency, month_day, send_hour").in("client_id", [...clients.keys()])
    : { data: [] };
  const byClient = new Map((settings ?? []).map((s) => [s.client_id, { frequency: s.frequency as ReportFrequency, monthDay: s.month_day, hour: s.send_hour }]));

  const due = [...clients].flatMap(([id, c]) => {
    const s = byClient.get(id) ?? DEFAULT_SCHEDULE;
    if (s.frequency === "desligado" || !scheduleDue(s, clock)) return [];
    const range = scheduleRange(s.frequency, clock.date);
    return [{ id, ...c, frequency: s.frequency, range, key: scheduleKey(s.frequency, id, range) }];
  });
  // Já enviados (ou tentados) neste período não entram de novo.
  const { data: done } = due.length ? await db.from("whatsapp_outbox").select("dedupe_key").in("dedupe_key", due.map((d) => d.key)) : { data: [] };
  const skip = new Set((done ?? []).map((d) => d.dedupe_key));
  const pending = due.filter((d) => !skip.has(d.key));

  let sent = 0;
  let left = 0;
  const errors: string[] = [];
  for (const [i, d] of pending.entries()) {
    if (Date.now() - started > budget) {
      left = pending.length - i;
      break;
    }
    if (i > 0) await pause(gap);
    const r = await sendClientReport(d.org, { id: d.id, name: d.name }, d.range, { dedupeKey: d.key, frequency: d.frequency });
    if (r.sent) sent++;
    const problem = r.error ?? r.pdfError;
    if (problem) errors.push(`${d.name}: ${problem}`);
  }
  return { due: due.length, sent, left, errors: errors.slice(0, 10) };
}
