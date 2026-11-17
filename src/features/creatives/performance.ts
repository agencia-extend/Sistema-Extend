import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CreativeTotals } from "@/domain/creatives/performance";

// Números dos criativos (RF-BIB-03). As funções do banco só devolvem os criativos cujos números a pessoa pode ver
// ("Ver performance dos criativos" no cliente); para os demais, nada aparece.

type Raw = {
  library_id: string; ads: number; active_ads: number; spend_cents: number; impressions: number; clicks: number; link_clicks: number;
  leads: number; messages: number; purchases: number; purchase_value_cents: number; video_views: number; thruplays: number;
  days_live: number; first_day: string | null; last_day: string | null; frequency: number | null; fatigued: boolean;
};

const toTotals = (r: Raw): CreativeTotals => ({
  ads: r.ads,
  activeAds: r.active_ads,
  spendCents: Number(r.spend_cents),
  impressions: Number(r.impressions),
  clicks: Number(r.clicks),
  linkClicks: Number(r.link_clicks),
  leads: Number(r.leads),
  messages: Number(r.messages),
  purchases: Number(r.purchases),
  purchaseValueCents: Number(r.purchase_value_cents),
  videoViews: Number(r.video_views),
  thruplays: Number(r.thruplays),
  daysLive: r.days_live,
  firstDay: r.first_day,
  lastDay: r.last_day,
  frequency: r.frequency === null ? null : Number(r.frequency),
  fatigued: r.fatigued,
});

/** Totais por criativo no período (sem datas: tudo o que foi sincronizado). Só criativos com anúncio ligado. */
export async function getPerformance(ids: string[], range?: { since: string; until: string }): Promise<Map<string, CreativeTotals>> {
  const out = new Map<string, CreativeTotals>();
  if (!ids.length) return out;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("creative_performance", { p_ids: ids, p_since: range?.since, p_until: range?.until });
  if (error) throw error;
  for (const r of (data ?? []) as Raw[]) if (r.ads > 0) out.set(r.library_id, toTotals(r));
  return out;
}

export type LinkedAd = { adId: string; name: string; status: string | null; thumbnailUrl: string | null; accountName: string; campaignName: string | null; source: "codigo" | "manual"; frequency: number | null; fatigued: boolean };
export type LinkableAd = { adId: string; name: string; status: string | null; accountName: string; campaignName: string | null };

/** Criativo na biblioteca a partir da demanda, com os anúncios ligados, os que dá para ligar e os totais. */
export async function getCreativePerformance(taskId: string) {
  const supabase = await createClient();
  const { data: lib } = await supabase.from("creative_library").select("id, client_id, status, ref_number").eq("task_id", taskId).maybeSingle();
  if (!lib) return null;
  const [linked, linkable, canLink, totals] = await Promise.all([
    supabase.rpc("creative_linked_ads", { p_library: lib.id }),
    supabase.rpc("creative_linkable_ads", { p_library: lib.id }),
    supabase.rpc("can_manage_client_ads", { p_client: lib.client_id }),
    getPerformance([lib.id]),
  ]);
  if (linked.error) throw linked.error;
  // Sem permissão para ver os números a função devolve vazio; a seção some (perm decide na tela).
  return {
    libraryId: lib.id,
    status: lib.status,
    ref: Number(lib.ref_number),
    linked: (linked.data ?? []).map((a): LinkedAd => ({
      adId: a.ad_id, name: a.name, status: a.effective_status, thumbnailUrl: a.thumbnail_url, accountName: a.account_name, campaignName: a.campaign_name,
      source: a.source as LinkedAd["source"], frequency: a.frequency === null ? null : Number(a.frequency), fatigued: a.fatigued,
    })),
    linkable: (linkable.data ?? []).map((a): LinkableAd => ({ adId: a.ad_id, name: a.name, status: a.effective_status, accountName: a.account_name, campaignName: a.campaign_name })),
    canLinkAsTraffic: canLink.data === true,
    totals: totals.get(lib.id) ?? null,
  };
}
