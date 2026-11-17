// Performance por criativo na biblioteca (RF-BIB-03): indicadores a partir da soma dos anúncios ligados.
// Divisão por zero vira null (a tela mostra "—").

export type CreativeTotals = {
  ads: number;
  activeAds: number;
  spendCents: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number;
  messages: number;
  purchases: number;
  purchaseValueCents: number;
  videoViews: number;
  thruplays: number;
  daysLive: number;
  firstDay: string | null;
  lastDay: string | null;
  frequency: number | null;
  fatigued: boolean;
};

export type CreativeKpis = {
  ctr: number | null;
  cpcCents: number | null;
  cpmCents: number | null;
  cplCents: number | null;
  costPerMessageCents: number | null;
  /** Visualizações de 3 s ÷ impressões. */
  hookRate: number | null;
  /** ThruPlays (até o fim ou 15 s) ÷ impressões. */
  holdRate: number | null;
  roas: number | null;
};

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const cents = (a: number, b: number) => (b > 0 ? Math.round(a / b) : null);

export function creativeKpis(t: CreativeTotals): CreativeKpis {
  const clicks = t.linkClicks || t.clicks;
  const video = t.videoViews > 0;
  return {
    ctr: ratio(clicks, t.impressions),
    cpcCents: cents(t.spendCents, clicks),
    cpmCents: t.impressions > 0 ? Math.round((t.spendCents / t.impressions) * 1000) : null,
    cplCents: cents(t.spendCents, t.leads),
    costPerMessageCents: cents(t.spendCents, t.messages),
    hookRate: video ? ratio(t.videoViews, t.impressions) : null,
    holdRate: video ? ratio(t.thruplays, t.impressions) : null,
    roas: t.spendCents > 0 && t.purchaseValueCents > 0 ? t.purchaseValueCents / t.spendCents : null,
  };
}

/** Código do criativo para pôr no nome do anúncio. */
export const creativeCode = (ref: number) => `CR-${ref}`;

/** O nome do anúncio tem o código do criativo? (mesma regra do banco: CR42, CR-42, cr-0042, separado de letras e números). */
export function nameHasCode(name: string, ref: number): boolean {
  return new RegExp(`(^|[^a-z0-9])cr-?0*${ref}([^0-9]|$)`, "i").test(name);
}

/** Sugestão de situação (RF-BIB-02): fadigado quando um anúncio ligado está com alerta de fadiga em aberto. */
export function suggestedStatus(status: string, t: Pick<CreativeTotals, "fatigued"> | null | undefined): "fadigado" | null {
  if (!t?.fatigued) return null;
  return status === "em_teste" || status === "vencedor" ? "fadigado" : null;
}

export type PerformanceSort = "recentes" | "investimento" | "ctr" | "custo";
export const PERFORMANCE_SORT_LABEL: Record<PerformanceSort, string> = {
  recentes: "Mais recentes",
  investimento: "Maior investimento",
  ctr: "Maior CTR",
  custo: "Menor custo por resultado",
};
export const parseSort = (v: string | undefined): PerformanceSort => (v && v in PERFORMANCE_SORT_LABEL ? (v as PerformanceSort) : "recentes");

/** Custo por resultado do criativo: lead, senão conversa, senão compra. */
export function costPerResult(t: CreativeTotals): number | null {
  return cents(t.spendCents, t.leads) ?? cents(t.spendCents, t.messages) ?? cents(t.spendCents, t.purchases);
}
