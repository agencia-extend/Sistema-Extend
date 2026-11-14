/**
 * Calendário de marketing (RF-PLA-04/05): tipos de data, quando o pedido de criativo sai e o
 * agrupamento por mês. Datas no formato AAAA-MM-DD (dia de São Paulo).
 */

export const MARKETING_KINDS = ["lancamento", "promocao", "evento", "sazonal", "outro"] as const;
export type MarketingKind = (typeof MARKETING_KINDS)[number];
export const MARKETING_KIND_LABEL: Record<MarketingKind, string> = {
  lancamento: "Lançamento",
  promocao: "Promoção",
  evento: "Evento",
  sazonal: "Data sazonal",
  outro: "Outra",
};

export const DEFAULT_LEAD_DAYS = 15;

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const parse = (day: string) => new Date(`${day}T12:00:00Z`);
const key = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  const d = parse(day);
  d.setUTCDate(d.getUTCDate() + n);
  return key(d);
}

/** Primeiro dia do mês, n meses depois. */
export function addMonths(monthStart: string, n: number): string {
  const d = parse(`${monthStart.slice(0, 7)}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return key(d);
}

export function lastDayOfMonth(monthStart: string): string {
  return addDays(addMonths(monthStart, 1), -1);
}

/** Dia em que o pedido de criativo é criado (o job roda todo dia de manhã). */
export function requestDay(onDate: string, leadDays: number): string {
  return addDays(onDate, -leadDays);
}

/** Prazo do criativo pedido: 5 dias antes da data, nunca antes de 2 dias a partir de hoje. */
export function creativeDueDay(onDate: string, today: string): string {
  const due = addDays(onDate, -5);
  const min = addDays(today, 2);
  return due < min ? min : due;
}

export type RequestState =
  | { kind: "none" }
  | { kind: "scheduled"; on: string }
  | { kind: "created"; taskId: string }
  | { kind: "error"; message: string }
  | { kind: "missed" };

export function requestState(
  d: { onDate: string; leadDays: number; hasBrief: boolean; requestTaskId: string | null; requestedAt: string | null; requestError: string | null },
  today: string,
): RequestState {
  if (!d.hasBrief) return { kind: "none" };
  if (d.requestTaskId) return { kind: "created", taskId: d.requestTaskId };
  if (d.requestedAt) return { kind: "none" };
  if (d.requestError) return { kind: "error", message: d.requestError };
  if (d.onDate < today) return { kind: "missed" };
  const on = requestDay(d.onDate, d.leadDays);
  return { kind: "scheduled", on: on < today ? today : on };
}

export function dayParts(day: string): { day: number; weekday: string; month: string } {
  const d = parse(day);
  return { day: d.getUTCDate(), weekday: WEEKDAYS[d.getUTCDay()], month: MONTHS[d.getUTCMonth()] };
}

export function monthTitle(day: string): string {
  const d = parse(day);
  return `${MONTHS[d.getUTCMonth()][0].toUpperCase()}${MONTHS[d.getUTCMonth()].slice(1)} de ${d.getUTCFullYear()}`;
}

export function shortDate(day: string): string {
  const d = parse(day);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Agrupa por mês, na ordem das datas. */
export function groupByMonth<T extends { onDate: string }>(items: T[]): { month: string; items: T[] }[] {
  const sorted = [...items].sort((a, b) => a.onDate.localeCompare(b.onDate));
  const out: { month: string; items: T[] }[] = [];
  for (const it of sorted) {
    const m = `${it.onDate.slice(0, 7)}-01`;
    const last = out[out.length - 1];
    if (last && last.month === m) last.items.push(it);
    else out.push({ month: m, items: [it] });
  }
  return out;
}
