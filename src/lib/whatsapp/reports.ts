import "server-only";
import { buildAdsReport, lastWeek } from "@/domain/ads/report";
import { todayKey } from "@/domain/media";
import { getTrafficPanel } from "@/features/ads/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsapp, sendAndLog, type StoredWhatsapp } from "./store";

/** Grupo de relatórios da conexão (onde todos os relatórios chegam; o gestor encaminha a cada cliente). */
export async function reportsGroup(c: StoredWhatsapp) {
  const { data } = await createAdminClient().from("whatsapp_groups").select("jid, name").eq("connection_id", c.id).eq("is_reports", true).maybeSingle();
  return data;
}

/** Monta o relatório de um cliente no período, com os números já sincronizados. null = sem gasto. */
export async function clientReport(organizationId: string, client: { id: string; name: string }, range: { start: string; end: string }) {
  const accounts = await getTrafficPanel(range, todayKey(new Date()), client.id, { db: createAdminClient(), organizationId });
  return buildAdsReport({ clientName: client.name, range, accounts });
}

/**
 * Envia o relatório de um cliente para o grupo de relatórios. Devolve o erro em português ou null.
 * dedupeKey evita mandar duas vezes o automático da mesma semana.
 */
export async function sendClientReport(organizationId: string, client: { id: string; name: string }, range: { start: string; end: string }, opts: { createdBy?: string | null; dedupeKey?: string } = {}) {
  const c = await getWhatsapp(organizationId);
  if (!c) return { error: "O WhatsApp da Extend ainda não foi configurado (Configurações › WhatsApp).", sent: false };
  const group = await reportsGroup(c);
  if (!group) return { error: "Marque o grupo de relatórios em Configurações › WhatsApp.", sent: false };
  const text = await clientReport(organizationId, client, range);
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
