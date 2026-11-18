// Relatório de anúncios (RF-REL-01/02/05): os números do período de um cliente, em texto de WhatsApp montado a
// partir de um modelo com variáveis, e os mesmos números para o PDF. Puro, sem rede.
import { RESULT_LABEL, emptyTotals, kpis, type Kpis, type ResultKind, type Totals } from ".";

export type ReportCampaign = { name: string; kind: ResultKind; totals: Totals; kpis: Kpis };
export type ReportAccount = { name: string; isPrepay: boolean | null; fundsCents: number | null; daysLeft: number | null; totals: Totals; campaigns: ReportCampaign[] };
/** Anúncio com o melhor resultado do período (para {top_criativo}). */
export type ReportTopAd = { name: string; kind: ResultKind; results: number; costPerResultCents: number | null };
export type ReportData = { clientName: string; range: { start: string; end: string }; accounts: ReportAccount[]; topAd?: ReportTopAd | null };

// Espaço comum no lugar do espaço fixo do Intl (o texto vai para o WhatsApp e para modelos digitados).
const brl = (cents: number | null) => (cents === null ? "—" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " "));
const int = (n: number) => n.toLocaleString("pt-BR");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Semana anterior completa (segunda a domingo) a partir de hoje (dia de São Paulo). */
export function lastWeek(today: string): { start: string; end: string } {
  const d = new Date(`${today}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dow - 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

/** Variáveis que o modelo aceita, na ordem em que aparecem para inserir. */
export const REPORT_VARIABLES = [
  { key: "cliente", label: "Nome do cliente" },
  { key: "periodo", label: "Período (09/11 a 15/11)" },
  { key: "investimento", label: "Investimento" },
  { key: "impressoes", label: "Impressões" },
  { key: "cliques", label: "Cliques no link" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "Custo por clique" },
  { key: "cpm", label: "CPM" },
  { key: "leads", label: "Leads" },
  { key: "cpl", label: "Custo por lead" },
  { key: "conversas", label: "Conversas iniciadas" },
  { key: "custo_conversa", label: "Custo por conversa" },
  { key: "compras", label: "Compras" },
  { key: "roas", label: "ROAS" },
  { key: "saldo", label: "Saldo da conta pré-paga" },
  { key: "dias_saldo", label: "Dias que o saldo dura" },
  { key: "top_criativo", label: "Anúncio com melhor resultado" },
  { key: "campanhas", label: "Lista das campanhas (várias linhas)" },
] as const;
export type ReportVariable = (typeof REPORT_VARIABLES)[number]["key"];
const KNOWN = new Set<string>(REPORT_VARIABLES.map((v) => v.key));

export const DEFAULT_REPORT_TEMPLATE = [
  "📊 *Relatório de anúncios — {cliente}*",
  "Período: {periodo}",
  "",
  "💰 Investimento: *{investimento}*",
  "👀 Impressões: {impressoes}",
  "🖱️ Cliques: {cliques} · CTR {ctr}",
  "",
  "{campanhas}",
  "",
  "🏆 Destaque: {top_criativo}",
  "💳 Saldo da conta: {saldo} (dá para ~{dias_saldo})",
].join("\n");

const VAR = /\{([a-z_]+)\}/g;

/** Variáveis do texto que o sistema não conhece (erro ao salvar o modelo). */
export function unknownVariables(body: string): string[] {
  return [...new Set([...body.matchAll(VAR)].map((m) => m[1]).filter((k) => !KNOWN.has(k)))];
}

/** Totais do cliente no período (soma das contas). */
export function reportTotals(data: ReportData): Totals {
  const t = emptyTotals();
  for (const a of data.accounts) for (const k of Object.keys(t) as (keyof Totals)[]) t[k] += a.totals[k];
  return t;
}

function campaignLines(data: ReportData): string {
  const lines: string[] = [];
  const spending = data.accounts.filter((x) => x.totals.spend_cents > 0);
  for (const a of spending) {
    if (spending.length > 1) lines.push(`*${a.name}* — ${brl(a.totals.spend_cents)}`);
    for (const c of a.campaigns.filter((x) => x.totals.spend_cents > 0)) {
      const label = RESULT_LABEL[c.kind];
      const result = c.kind === "impressions" ? `${int(c.totals.impressions)} impressões` : `${int(c.kpis.results)} ${c.kpis.results === 1 ? label.one : label.many}`;
      const cost = c.kind !== "impressions" && c.kpis.costPerResultCents !== null ? ` · ${brl(c.kpis.costPerResultCents)} cada` : "";
      lines.push(`▪️ ${c.name}`, `   ${brl(c.totals.spend_cents)} · ${result}${cost} · CTR ${pct(c.kpis.ctr)}`);
    }
  }
  return lines.join("\n");
}

/** Custo por resultado de um tipo: o gasto das campanhas desse objetivo dividido pelo resultado (sem elas, o gasto todo). */
function costOf(data: ReportData, kind: ResultKind, count: number, totalSpend: number): string {
  if (!count) return "";
  const spend = data.accounts.flatMap((a) => a.campaigns).filter((c) => c.kind === kind).reduce((s, c) => s + c.totals.spend_cents, 0);
  return brl(Math.round((spend || totalSpend) / count));
}

/** Valor de cada variável. Vazio quando não se aplica (ex.: saldo de conta pós-paga, CPL sem leads). */
export function reportValues(data: ReportData): Record<ReportVariable, string> {
  const t = reportTotals(data);
  const k = kpis(t, "leads");
  const clicks = t.link_clicks || t.clicks;
  const prepay = data.accounts.filter((a) => a.isPrepay && a.fundsCents !== null);
  const funds = prepay.reduce((s, a) => s + (a.fundsCents ?? 0), 0);
  const days = prepay.map((a) => a.daysLeft).filter((d): d is number => d !== null);
  const minDays = days.length ? Math.min(...days) : null;
  const top = data.topAd;
  const topLabel = top ? RESULT_LABEL[top.kind] : null;
  return {
    cliente: data.clientName,
    periodo: `${br(data.range.start)} a ${br(data.range.end)}`,
    investimento: brl(t.spend_cents),
    impressoes: int(t.impressions),
    cliques: int(clicks),
    ctr: k.ctr === null ? "" : pct(k.ctr),
    cpc: k.cpcCents === null ? "" : brl(k.cpcCents),
    cpm: k.cpmCents === null ? "" : brl(k.cpmCents),
    leads: int(t.leads),
    cpl: costOf(data, "leads", t.leads, t.spend_cents),
    conversas: int(t.messages),
    custo_conversa: costOf(data, "messages", t.messages, t.spend_cents),
    compras: int(t.purchases),
    roas: k.roas === null ? "" : `${k.roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`,
    saldo: prepay.length ? brl(funds) : "",
    dias_saldo: minDays === null ? "" : `${minDays} ${minDays === 1 ? "dia" : "dias"}`,
    top_criativo:
      top && topLabel && top.results > 0
        ? `${top.name} (${int(top.results)} ${top.results === 1 ? topLabel.one : topLabel.many}${top.costPerResultCents !== null ? ` a ${brl(top.costPerResultCents)} cada` : ""})`
        : "",
    campanhas: campaignLines(data),
  };
}

/**
 * Preenche o modelo. Linha com uma variável sem valor some (assim o modelo serve a contas pré e pós-pagas e a
 * clientes com ou sem leads). Variável desconhecida fica como está.
 */
export function renderReport(body: string, values: Record<string, string>): string {
  const out: string[] = [];
  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const keys = [...line.matchAll(VAR)].map((m) => m[1]).filter((key) => key in values);
    if (keys.some((key) => values[key] === "")) continue;
    out.push(line.replace(VAR, (all, key: string) => (key in values ? values[key] : all)));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Texto do relatório no modelo. null quando não houve gasto no período (nada a relatar). */
export function buildAdsReport(data: ReportData, template: string = DEFAULT_REPORT_TEMPLATE): string | null {
  if (reportTotals(data).spend_cents <= 0) return null;
  return renderReport(template, reportValues(data));
}

/** Dados de exemplo para a prévia do modelo nas configurações. */
export function sampleReportData(): ReportData {
  const a = { ...emptyTotals(), spend_cents: 84000, impressions: 52000, clicks: 1300, link_clicks: 910, leads: 42 };
  const b = { ...emptyTotals(), spend_cents: 56000, impressions: 31000, clicks: 700, link_clicks: 520, messages: 64 };
  const all = { ...emptyTotals(), spend_cents: 140000, impressions: 83000, clicks: 2000, link_clicks: 1430, leads: 42, messages: 64 };
  return {
    clientName: "Clínica Exemplo",
    range: { start: "2026-11-09", end: "2026-11-15" },
    accounts: [{
      name: "Conta Exemplo", isPrepay: true, fundsCents: 45000, daysLeft: 2, totals: all,
      campaigns: [
        { name: "Cadastros Clareamento", kind: "leads", totals: a, kpis: kpis(a, "leads") },
        { name: "Mensagens Implante", kind: "messages", totals: b, kpis: kpis(b, "messages") },
      ],
    }],
    topAd: { name: "VIDEO_SORRISO_CR-12_V2", kind: "leads", results: 28, costPerResultCents: 1650 },
  };
}

// Envio automático (RF-REL-01): diário (ontem), semanal na segunda (semana passada) ou mensal no dia escolhido (mês passado).
export type ReportFrequency = "desligado" | "diario" | "semanal" | "mensal";
export type ReportSchedule = { frequency: ReportFrequency; monthDay: number; hour: number };
export const DEFAULT_SCHEDULE: ReportSchedule = { frequency: "semanal", monthDay: 1, hour: 9 };
export const FREQUENCY_LABEL: Record<ReportFrequency, string> = {
  desligado: "Não enviar sozinho",
  diario: "Todo dia (dia anterior)",
  semanal: "Toda segunda (semana passada)",
  mensal: "Todo mês (mês passado)",
};

/** Data, hora, dia da semana (segunda = 1) e dia do mês em São Paulo. */
export function spClock(now: Date): { date: string; hour: number; isoDow: number; day: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const isoDow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday) + 1;
  return { date, hour: Number(parts.hour), isoDow, day: Number(parts.day) };
}

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Período que o relatório da frequência cobre, enviado hoje. */
export function scheduleRange(frequency: Exclude<ReportFrequency, "desligado">, today: string): { start: string; end: string } {
  if (frequency === "diario") return { start: shift(today, -1), end: shift(today, -1) };
  if (frequency === "semanal") return lastWeek(today);
  const end = shift(`${today.slice(0, 7)}-01`, -1);
  return { start: `${end.slice(0, 7)}-01`, end };
}

/**
 * Hoje é dia de envio e já passou do horário? O job roda de hora em hora; a partir do horário do cliente ele
 * tenta até conseguir no mesmo dia (o registro de envios impede repetir).
 */
export function scheduleDue(s: ReportSchedule, clock: { hour: number; isoDow: number; day: number }): boolean {
  if (s.frequency === "desligado" || clock.hour < s.hour) return false;
  if (s.frequency === "semanal") return clock.isoDow === 1;
  if (s.frequency === "mensal") return clock.day === s.monthDay;
  return true;
}

/** Chave que impede mandar duas vezes o mesmo relatório automático (a semanal mantém a chave antiga). */
export const scheduleKey = (frequency: Exclude<ReportFrequency, "desligado">, clientId: string, range: { start: string }) =>
  frequency === "semanal" ? `relatorio:${clientId}:${range.start}` : `relatorio:${frequency}:${clientId}:${range.start}`;
