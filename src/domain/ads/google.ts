// Google Ads → mesmas tabelas da Meta (RF-ADS-03/08). Regras puras, sem rede.
//
// - Situação: ENABLED → ACTIVE, PAUSED → PAUSED, REMOVED → DELETED (o painel, os filtros e os alertas
//   usam a situação da Meta). Anúncio com política DISAPPROVED fica DISAPPROVED (entra nas reprovações).
// - Objetivo: GOOGLE_<tipo de canal> (ex.: GOOGLE_SEARCH). O resultado de uma campanha do Google é a
//   conversão (gravada em "leads", com o valor em purchase_value_cents para o ROAS); sem conversões,
//   o resultado é o clique.
// - Dinheiro: o Google manda micros (1 real = 1.000.000); o sistema guarda centavos.

export const microsToCents = (micros: string | number | null | undefined): number | null => {
  if (micros === null || micros === undefined || micros === "") return null;
  const n = Number(micros);
  return Number.isFinite(n) ? Math.round(n / 10_000) : null;
};

export function googleStatus(status: string | null | undefined): string | null {
  switch ((status ?? "").toUpperCase()) {
    case "ENABLED":
      return "ACTIVE";
    case "PAUSED":
      return "PAUSED";
    case "REMOVED":
      return "DELETED";
    default:
      return status ? status.toUpperCase() : null;
  }
}

/** Situação do anúncio: reprovado pela política vence a situação de entrega. */
export function googleAdStatus(status: string | null | undefined, approval: string | null | undefined): string | null {
  if ((approval ?? "").toUpperCase() === "DISAPPROVED") return "DISAPPROVED";
  return googleStatus(status);
}

export const googleObjective = (channel: string | null | undefined) => (channel ? `GOOGLE_${channel.toUpperCase()}` : "GOOGLE");

export const isGoogleObjective = (objective: string | null | undefined) => (objective ?? "").toUpperCase().startsWith("GOOGLE");

/** Data do Google (AAAA-MM-DD) sem fuso: a conta já responde no fuso dela. */
export const gaqlDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export type GoogleMetrics = {
  costMicros?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  conversions?: string | number;
  conversionsValue?: string | number;
};

/** Números de um dia no formato de ad_insights_daily. Conversões fracionadas (atribuição) são arredondadas. */
export function googleInsight(m: GoogleMetrics | undefined) {
  const num = (v: unknown) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const clicks = Math.round(num(m?.clicks));
  return {
    spend_cents: microsToCents(m?.costMicros) ?? 0,
    impressions: Math.round(num(m?.impressions)),
    reach: 0,
    clicks,
    link_clicks: clicks,
    leads: Math.round(num(m?.conversions)),
    messages: 0,
    purchases: 0,
    purchase_value_cents: Math.round(num(m?.conversionsValue) * 100),
    landing_page_views: 0,
    video_views: 0,
    thruplays: 0,
  };
}
