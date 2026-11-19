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

// Período dos números (RF-BIB-04): tudo o que foi sincronizado, últimos 30 dias ou um mês (os 6 mais recentes).
export type PerfPeriod = "tudo" | "30d" | `${number}-${number}`;

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;

/** Meses que dá para escolher: o atual e os 5 anteriores. */
export function recentMonths(today: string, count = 6): string[] {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

export function parsePerfPeriod(v: string | undefined, today: string): PerfPeriod {
  if (v === "30d") return "30d";
  if (v && /^\d{4}-\d{2}$/.test(v) && recentMonths(today).includes(v)) return v as PerfPeriod;
  return "tudo";
}

export const perfPeriodLabel = (p: PerfPeriod) => (p === "tudo" ? "Todo o período" : p === "30d" ? "Últimos 30 dias" : monthLabel(p));

/** Datas do período (até ontem nos 30 dias; o mês inteiro, mesmo o atual). Tudo = sem datas. */
export function perfRange(p: PerfPeriod, today: string): { since: string; until: string } | undefined {
  if (p === "tudo") return undefined;
  const shift = (d: string, n: number) => {
    const x = new Date(`${d}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  if (p === "30d") return { since: shift(today, -30), until: shift(today, -1) };
  const next = Number(p.slice(5, 7)) === 12 ? `${Number(p.slice(0, 4)) + 1}-01` : `${p.slice(0, 4)}-${String(Number(p.slice(5, 7)) + 1).padStart(2, "0")}`;
  return { since: `${p}-01`, until: shift(`${next}-01`, -1) };
}

/** Resultados do criativo: leads + conversas + compras. */
export const creativeResults = (t: CreativeTotals) => t.leads + t.messages + t.purchases;

/**
 * Top criativos do período: mais resultados primeiro e, no empate, o menor custo por resultado. Sem resultado não
 * entra (criativo só de alcance não disputa com o de leads).
 */
export function topCreatives<T extends { id: string }>(items: T[], perf: Map<string, CreativeTotals>, n = 3): (T & { totals: CreativeTotals })[] {
  return items
    .flatMap((i) => {
      const t = perf.get(i.id);
      return t && creativeResults(t) > 0 ? [{ ...i, totals: t }] : [];
    })
    .sort((a, b) => creativeResults(b.totals) - creativeResults(a.totals) || (costPerResult(a.totals) ?? Infinity) - (costPerResult(b.totals) ?? Infinity))
    .slice(0, n);
}
