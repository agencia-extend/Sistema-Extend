import type { CreativeFormat, CreativeObjective } from "./index";

// Pedido de criativo a partir de um anúncio (RF-CRI-08): o que dá para tirar do anúncio sincronizado.

/** Objetivo da campanha na Meta (OUTCOME_* e os antigos) → objetivo do pedido. Sem correspondência, a pessoa escolhe. */
export function objectiveFromMeta(objective: string | null | undefined): CreativeObjective | null {
  const o = (objective ?? "").toUpperCase();
  if (!o) return null;
  if (o.includes("MESSAGE")) return "mensagens";
  if (o.includes("LEAD")) return "leads";
  if (o.includes("SALES") || o.includes("CONVERSION") || o.includes("PRODUCT_CATALOG")) return "vendas";
  if (o.includes("TRAFFIC") || o.includes("LINK_CLICK")) return "trafego";
  if (o.includes("AWARENESS") || o.includes("REACH") || o.includes("BRAND")) return "reconhecimento";
  if (o.includes("ENGAGEMENT") || o.includes("VIDEO_VIEWS") || o.includes("POST_ENGAGEMENT") || o.includes("PAGE_LIKES")) return "engajamento";
  return null;
}

/** Referência do anúncio guardada no pedido (`creative_requests.source_ad_ref`). */
export const adRef = (provider: "meta" | "google", externalId: string) => `${provider}:${externalId}`;
export const AD_REF = /^(meta|google):[A-Za-z0-9_-]{1,64}$/;

/** Link do anúncio no Gerenciador de Anúncios da Meta (só abre para quem tem acesso à conta). */
export function adsManagerUrl(accountExternalId: string, adExternalId: string): string {
  const act = accountExternalId.replace(/^act_/, "");
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${encodeURIComponent(act)}&selected_ad_ids=${encodeURIComponent(adExternalId)}`;
}

export type AdSource = {
  provider: "meta" | "google";
  accountExternalId: string;
  adExternalId: string;
  adName: string;
  campaignName: string | null;
  campaignObjective: string | null;
  frequency: number | null;
  fatigued: boolean;
  /** Criativo da biblioteca ligado ao anúncio, se houver. */
  library: { code: string; format: CreativeFormat; angle: string; campaign: string } | null;
};

export type RequestPrefill = {
  campaign: string;
  objective: CreativeObjective | "";
  format: CreativeFormat | "";
  angle: string;
  references: string[];
  priority: "media" | "alta";
  notes: string;
  sourceAdRef: string;
};

const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);

/** Valores iniciais do pedido: a pessoa revisa e completa (público, CTA e prazo continuam com ela). */
export function prefillFromAd(ad: AdSource): RequestPrefill {
  const why = ad.fatigued
    ? `está cansado${ad.frequency !== null ? ` (frequência ${String(Math.round(ad.frequency * 10) / 10).replace(".", ",")} em 7 dias, CTR caindo)` : ""}`
    : "precisa de uma nova versão";
  const base = ad.library ? `Criativo ${ad.library.code} (anúncio "${ad.adName}")` : `Anúncio "${ad.adName}"`;
  return {
    campaign: cut(ad.campaignName ?? ad.library?.campaign ?? "", 160),
    objective: objectiveFromMeta(ad.campaignObjective) ?? "",
    format: ad.library?.format ?? "",
    angle: cut(ad.library?.angle ? `Nova versão: ${ad.library.angle}` : "", 300),
    references: ad.provider === "meta" ? [adsManagerUrl(ad.accountExternalId, ad.adExternalId)] : [],
    priority: ad.fatigued ? "alta" : "media",
    notes: cut(`${base} ${why}. Pedido de um novo criativo para substituir.`, 2000),
    sourceAdRef: adRef(ad.provider, ad.adExternalId),
  };
}
