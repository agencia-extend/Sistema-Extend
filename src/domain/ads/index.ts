// Regras puras dos anúncios sincronizados (sem rede): leitura dos números da Meta, resultado por objetivo,
// indicadores do período, saldo pré-pago e previsão de dias.

/** "3345.74" (unidades da moeda) → 334574 centavos. */
export function toCents(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Valor que a Meta já manda em centavos ("16844") → número; vazio → null. */
export function centsOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const int = (v: string | number | undefined) => (v === undefined ? 0 : Math.round(Number(v) || 0));

type Action = { action_type: string; value: string };

/** Primeira ação presente na ordem de preferência (a Meta repete o mesmo evento com nomes diferentes). */
function pick(actions: Action[] | undefined, types: string[]): number {
  if (!actions?.length) return 0;
  for (const t of types) {
    const hit = actions.find((a) => a.action_type === t);
    if (hit) return int(hit.value);
  }
  return 0;
}

const LEADS = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead"];
const MESSAGES = ["onsite_conversion.messaging_conversation_started_7d"];
const PURCHASES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"];

export type InsightRow = {
  date_start: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  actions?: Action[];
  action_values?: Action[];
  /** ThruPlays: vídeo visto até o fim ou por 15 s (hold rate). */
  video_thruplay_watched_actions?: Action[];
};

export type DailyMetrics = {
  date: string;
  spend_cents: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  leads: number;
  messages: number;
  purchases: number;
  purchase_value_cents: number;
  landing_page_views: number;
  video_views: number;
  thruplays: number;
};

/** Uma linha de insights da Meta (time_increment=1) → números do dia. */
export function parseInsight(r: InsightRow): DailyMetrics {
  return {
    date: r.date_start,
    spend_cents: toCents(r.spend),
    impressions: int(r.impressions),
    reach: int(r.reach),
    clicks: int(r.clicks),
    link_clicks: pick(r.actions, ["link_click"]),
    leads: pick(r.actions, LEADS),
    messages: pick(r.actions, MESSAGES),
    purchases: pick(r.actions, PURCHASES),
    purchase_value_cents: toCents(pick(r.action_values, PURCHASES) || (r.action_values?.find((a) => PURCHASES.includes(a.action_type))?.value ?? 0)),
    landing_page_views: pick(r.actions, ["landing_page_view"]),
    video_views: pick(r.actions, ["video_view"]),
    thruplays: pick(r.video_thruplay_watched_actions, ["video_view"]),
  };
}

export type Totals = Omit<DailyMetrics, "date" | "reach">;

export const emptyTotals = (): Totals => ({
  spend_cents: 0, impressions: 0, clicks: 0, link_clicks: 0, leads: 0, messages: 0, purchases: 0, purchase_value_cents: 0, landing_page_views: 0, video_views: 0, thruplays: 0,
});

/** Soma os dias (alcance não soma entre dias, por isso fica de fora). */
export function sumDays(rows: Partial<DailyMetrics>[]): Totals {
  const t = emptyTotals();
  for (const r of rows) for (const k of Object.keys(t) as (keyof Totals)[]) t[k] += Number(r[k] ?? 0);
  return t;
}

export type ResultKind = "leads" | "messages" | "purchases" | "link_clicks" | "video_views" | "impressions";

export const RESULT_LABEL: Record<ResultKind, { one: string; many: string; cost: string }> = {
  leads: { one: "lead", many: "leads", cost: "Custo por lead" },
  messages: { one: "conversa", many: "conversas", cost: "Custo por conversa" },
  purchases: { one: "compra", many: "compras", cost: "Custo por compra" },
  link_clicks: { one: "clique no link", many: "cliques no link", cost: "Custo por clique" },
  video_views: { one: "visualização", many: "visualizações", cost: "Custo por visualização" },
  impressions: { one: "impressão", many: "impressões", cost: "CPM" },
};

/**
 * Resultado principal pelo objetivo da campanha (RF-ADS-06). Para objetivos genéricos (engajamento,
 * tráfego), usa o que de fato aconteceu: conversas > leads > cliques no link.
 */
export function resultKind(objective: string | null | undefined, t?: Partial<Totals>): ResultKind {
  const o = (objective ?? "").toUpperCase();
  // Google Ads (src/domain/ads/google.ts): conversões ficam em "leads"; sem conversões, o clique.
  if (o.startsWith("GOOGLE")) return t?.leads ? "leads" : "link_clicks";
  if (o.includes("LEAD")) return "leads";
  if (o.includes("SALES") || o.includes("CONVERSIONS") || o.includes("PRODUCT_CATALOG")) return t?.purchases ? "purchases" : t?.leads ? "leads" : t?.messages ? "messages" : "purchases";
  if (o.includes("MESSAGES")) return "messages";
  if (o.includes("AWARENESS") || o.includes("REACH") || o.includes("BRAND")) return "impressions";
  if (o.includes("VIDEO")) return "video_views";
  if (t?.messages) return "messages";
  if (t?.leads) return "leads";
  return "link_clicks";
}

export type Kpis = { ctr: number | null; cpcCents: number | null; cpmCents: number | null; results: number; costPerResultCents: number | null; roas: number | null };

/** Indicadores do período a partir dos totais. */
export function kpis(t: Totals, kind: ResultKind): Kpis {
  const results = kind === "impressions" ? t.impressions : t[kind];
  const per = kind === "impressions" ? (t.impressions ? Math.round((t.spend_cents / t.impressions) * 1000) : null) : results ? Math.round(t.spend_cents / results) : null;
  return {
    ctr: t.impressions ? (t.link_clicks || t.clicks) / t.impressions : null,
    cpcCents: (t.link_clicks || t.clicks) ? Math.round(t.spend_cents / (t.link_clicks || t.clicks)) : null,
    cpmCents: t.impressions ? Math.round((t.spend_cents / t.impressions) * 1000) : null,
    results,
    costPerResultCents: per,
    roas: t.spend_cents && t.purchase_value_cents ? t.purchase_value_cents / t.spend_cents : null,
  };
}

/** Saldo disponível da conta pré-paga a partir do texto da Meta ("Saldo disponível (R$68,71 BRL)", "Available balance ($1,234.56 USD)"). */
export function prepaidFundsCents(display: string | null | undefined): number | null {
  // Só o valor entre parênteses com a moeda: "(R$68,71 BRL)". Cartão ("Visa *1234") não é saldo.
  const m = display?.match(/\((-?)[^\d()-]*(\d[\d.,\s]*?)\s*[A-Z]{3}\)/);
  if (!m) return null;
  let s = m[2].trim().replace(/\s/g, "");
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (lastSep >= 0 && s.length - lastSep - 1 <= 2) s = s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
  else s = s.replace(/[.,]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) * (m[1] === "-" ? -1 : 1) : null;
}

/** Dias até o saldo acabar, pelo gasto médio dos últimos 7 dias (RF-ADS-04). Sem gasto → null. */
export function daysLeft(fundsCents: number | null, last7SpendCents: number[]): number | null {
  if (fundsCents === null) return null;
  const spent = last7SpendCents.reduce((a, b) => a + b, 0);
  if (spent <= 0) return null;
  const avg = spent / 7;
  return Math.max(0, Math.floor(fundsCents / avg));
}

const STATUS: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  CAMPAIGN_PAUSED: "Campanha pausada",
  ADSET_PAUSED: "Conjunto pausado",
  DELETED: "Excluído",
  ARCHIVED: "Arquivado",
  IN_PROCESS: "Em processamento",
  WITH_ISSUES: "Com problemas",
  PENDING_REVIEW: "Em análise",
  DISAPPROVED: "Reprovado",
  PREAPPROVED: "Pré-aprovado",
  PENDING_BILLING_INFO: "Aguardando pagamento",
};
export const adStatusLabel = (s: string | null | undefined) => (s ? (STATUS[s] ?? s) : "—");
export const isRunning = (s: string | null | undefined) => s === "ACTIVE";

/** Período da tela → datas (dia de São Paulo). */
export type Period = "hoje" | "ontem" | "7d" | "30d" | "mes";
export const PERIOD_LABEL: Record<Period, string> = { hoje: "Hoje", ontem: "Ontem", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", mes: "Este mês" };

const shift = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function periodRange(p: Period, today: string): { start: string; end: string } {
  if (p === "hoje") return { start: today, end: today };
  if (p === "ontem") return { start: shift(today, -1), end: shift(today, -1) };
  if (p === "7d") return { start: shift(today, -6), end: today };
  if (p === "30d") return { start: shift(today, -29), end: today };
  return { start: `${today.slice(0, 7)}-01`, end: today };
}

export const parsePeriod = (v: string | undefined): Period => (v && v in PERIOD_LABEL ? (v as Period) : "7d");
