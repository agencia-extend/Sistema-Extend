import "server-only";
import { DEFAULT_SCHEDULE, type ReportFrequency, type ReportSchedule } from "@/domain/ads/report";
import { createClient } from "@/lib/supabase/server";

export type ReportTemplate = { id: string; name: string; body: string; isDefault: boolean; clients: number; updatedAt: string };

/** Modelos da agência com quantos clientes usam cada um (a RLS mostra a quem configura relatórios ou vê anúncios). */
export async function listReportTemplates(): Promise<ReportTemplate[]> {
  const supabase = await createClient();
  const [{ data, error }, { data: uses }] = await Promise.all([
    supabase.from("report_templates").select("id, name, body, is_default, updated_at").order("is_default", { ascending: false }).order("name"),
    supabase.from("client_report_settings").select("template_id"),
  ]);
  if (error) throw error;
  const count = new Map<string, number>();
  for (const u of uses ?? []) if (u.template_id) count.set(u.template_id, (count.get(u.template_id) ?? 0) + 1);
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, body: t.body, isDefault: t.is_default, clients: count.get(t.id) ?? 0, updatedAt: t.updated_at }));
}

/** Modelo escolhido para o cliente (null = padrão da agência) e a agenda do envio automático. */
export async function getClientReportSettings(clientId: string): Promise<{ templateId: string | null; schedule: ReportSchedule }> {
  const supabase = await createClient();
  const { data } = await supabase.from("client_report_settings").select("template_id, frequency, month_day, send_hour").eq("client_id", clientId).maybeSingle();
  if (!data) return { templateId: null, schedule: DEFAULT_SCHEDULE };
  return { templateId: data.template_id, schedule: { frequency: data.frequency as ReportFrequency, monthDay: data.month_day, hour: data.send_hour } };
}

export type ReportFile = { id: string; start: string; end: string; frequency: string; sizeBytes: number; sentAt: string; sentByName: string | null };

/** PDFs dos relatórios enviados (RF-REL-06), do mais recente; a RLS mostra a quem vê os anúncios do cliente. */
export async function listReportFiles(clientId: string): Promise<ReportFile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ads_report_files")
    .select("id, period_start, period_end, frequency, size_bytes, sent_at, profiles(full_name)")
    .eq("client_id", clientId)
    .order("sent_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { full_name: string } | null;
    return { id: r.id, start: r.period_start, end: r.period_end, frequency: r.frequency, sizeBytes: r.size_bytes, sentAt: r.sent_at, sentByName: p?.full_name ?? null };
  });
}
