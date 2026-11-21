import "server-only";
import { createClient } from "@/lib/supabase/server";
import { summarizeQuality, type LeadQuality } from "@/domain/ads/client-leads";

// Leads das campanhas do cliente no período, o resumo por campanha e o link de avaliação (RF-T2-01). A RLS filtra.

export const LEAD_PERIODS = { "30": "Últimos 30 dias", mes: "Este mês", anterior: "Mês passado", "90": "Últimos 90 dias" } as const;
export type LeadPeriod = keyof typeof LEAD_PERIODS;
export const isLeadPeriod = (v: unknown): v is LeadPeriod => typeof v === "string" && v in LEAD_PERIODS;

const shift = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Dias (São Paulo) do período, com o fim incluído. */
export function leadRange(p: LeadPeriod, today: string): { from: string; to: string } {
  if (p === "mes") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (p === "anterior") {
    const last = shift(`${today.slice(0, 7)}-01`, -1);
    return { from: `${last.slice(0, 7)}-01`, to: last };
  }
  return { from: shift(today, p === "90" ? -89 : -29), to: today };
}

export type ClientLeadItem = {
  id: string; name: string | null; phone: string | null; email: string | null; leadAt: string;
  campaignName: string | null; adName: string | null; formName: string | null; linked: boolean;
  quality: LeadQuality | null; note: string | null; ratedAt: string | null; ratedBy: string | null;
};

export async function clientLeadsData(clientId: string, range: { from: string; to: string }) {
  const supabase = await createClient();
  const start = new Date(`${range.from}T03:00:00Z`).toISOString();
  const end = new Date(Date.parse(`${range.to}T03:00:00Z`) + 86_400_000).toISOString();
  const [{ data, error }, { count: allTime }, { data: link }] = await Promise.all([
    supabase
      .from("client_leads")
      .select("id, name, phone, email, lead_at, campaign_id, campaign_name, ad_name, form_name, quality, quality_note, rated_at, rated_by_name, rater:profiles!client_leads_rated_by_fkey(full_name), campaign:ad_campaigns(id, name, external_id, ad_account_id)")
      .eq("client_id", clientId)
      .gte("lead_at", start)
      .lt("lead_at", end)
      .order("lead_at", { ascending: false })
      .limit(5000),
    supabase.from("client_leads").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    supabase.from("lead_review_links").select("id, created_at, last_used_at").eq("client_id", clientId).is("revoked_at", null).maybeSingle(),
  ]);
  if (error) throw error;
  const rows = data ?? [];
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? (v[0] ?? null) : v);

  // Gasto de cada campanha ligada, no mesmo período.
  const camps = new Map<string, { external_id: string; ad_account_id: string }>();
  for (const r of rows) {
    const c = one(r.campaign);
    if (c) camps.set(c.id, c);
  }
  const spend = new Map<string, number>();
  if (camps.size) {
    const { data: ins, error: e2 } = await supabase
      .from("ad_insights_daily")
      .select("ad_account_id, object_external_id, spend_cents")
      .eq("level", "campaign")
      .in("ad_account_id", [...new Set([...camps.values()].map((c) => c.ad_account_id))])
      .in("object_external_id", [...new Set([...camps.values()].map((c) => c.external_id))])
      .gte("date", range.from)
      .lte("date", range.to)
      .limit(20000);
    if (e2) throw e2;
    for (const [id, c] of camps) {
      const sum = (ins ?? []).filter((i) => i.ad_account_id === c.ad_account_id && i.object_external_id === c.external_id).reduce((s, i) => s + Number(i.spend_cents ?? 0), 0);
      spend.set(id, sum);
    }
  }

  const summary = summarizeQuality(
    rows.map((r) => ({ campaignId: r.campaign_id, campaignName: one(r.campaign)?.name ?? r.campaign_name, quality: r.quality as LeadQuality | null })),
    spend,
  );
  const leads: ClientLeadItem[] = rows.map((r) => ({
    id: r.id, name: r.name, phone: r.phone, email: r.email, leadAt: r.lead_at,
    campaignName: one(r.campaign)?.name ?? r.campaign_name, adName: r.ad_name, formName: r.form_name, linked: Boolean(r.campaign_id),
    quality: r.quality as LeadQuality | null, note: r.quality_note, ratedAt: r.rated_at,
    ratedBy: r.rated_by_name ?? one(r.rater)?.full_name ?? null,
  }));
  return { summary, leads, allTime: allTime ?? 0, link: link ? { createdAt: link.created_at, lastUsedAt: link.last_used_at } : null };
}
