import "server-only";
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

/** Modelo escolhido para o cliente (null = padrão da agência). */
export async function getClientTemplateId(clientId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("client_report_settings").select("template_id").eq("client_id", clientId).maybeSingle();
  return data?.template_id ?? null;
}
