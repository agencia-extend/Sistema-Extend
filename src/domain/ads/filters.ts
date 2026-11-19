// Filtros do módulo Anúncios (como no HubSystem, src/features/ads/filters.ts): período com comparação ao anterior,
// cliente, conta, status e agrupamento do gráfico. Tudo vem da URL e vale para todas as abas. Sem rede.

export type AdsPreset = "hoje" | "ontem" | "7d" | "30d" | "mes" | "mes_passado" | "custom";
export const ADS_PRESETS: [AdsPreset, string][] = [
  ["hoje", "Hoje"],
  ["ontem", "Ontem"],
  ["7d", "7 dias"],
  ["30d", "30 dias"],
  ["mes", "Este mês"],
  ["mes_passado", "Mês passado"],
];
export type AdsGroup = "dia" | "semana" | "mes";
export const GROUP_LABEL: Record<AdsGroup, string> = { dia: "dia", semana: "semana", mes: "mês" };
export type AdsStatus = "ativas" | "pausadas";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const monthEnd = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

export type AdsFilters = {
  preset: AdsPreset; from: string; to: string; prevFrom: string; prevTo: string; days: number;
  clientId?: string; accountId?: string; status?: AdsStatus; group: AdsGroup;
};

/** Período e filtros a partir da URL. O período anterior tem a mesma duração (para comparar). */
export function parseAdsFilters(sp: Record<string, string | string[] | undefined>, today: string): AdsFilters {
  const one = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const raw = one("periodo");
  const preset: AdsPreset = raw && (ADS_PRESETS.some(([p]) => p === raw) || raw === "custom") ? (raw as AdsPreset) : "7d";
  let from: string;
  let to: string;
  switch (preset) {
    case "hoje": from = today; to = today; break;
    case "ontem": from = shift(today, -1); to = from; break;
    case "30d": from = shift(today, -30); to = shift(today, -1); break;
    case "mes": from = `${today.slice(0, 7)}-01`; to = today; break;
    case "mes_passado": { const prev = shift(`${today.slice(0, 7)}-01`, -1); from = `${prev.slice(0, 7)}-01`; to = prev; break; }
    case "custom": {
      const de = one("de"), ate = one("ate");
      from = de && DATE.test(de) ? de : shift(today, -7);
      to = ate && DATE.test(ate) ? ate : shift(today, -1);
      if (from > to) [from, to] = [to, from];
      if (to > today) to = today;
      if (from > to) from = to;
      // Até 1 ano por consulta.
      if (Date.parse(to) - Date.parse(from) > 366 * 86_400_000) from = shift(to, -366);
      break;
    }
    default: from = shift(today, -7); to = shift(today, -1);
  }
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const prevTo = shift(from, -1);
  const prevFrom = shift(prevTo, -(days - 1));
  const status = one("status");
  const grp = one("agrupar");
  return {
    preset, from, to, prevFrom, prevTo, days,
    clientId: one("cliente") && UUID.test(one("cliente")!) ? one("cliente") : undefined,
    accountId: one("conta") && UUID.test(one("conta")!) ? one("conta") : undefined,
    status: status === "ativas" || status === "pausadas" ? status : undefined,
    group: grp === "semana" || grp === "mes" ? grp : "dia",
  };
}

/** Filtros como query string, para os links entre as abas. */
export function adsQuery(f: AdsFilters): string {
  const q = new URLSearchParams({ periodo: f.preset });
  if (f.preset === "custom") { q.set("de", f.from); q.set("ate", f.to); }
  if (f.clientId) q.set("cliente", f.clientId);
  if (f.accountId) q.set("conta", f.accountId);
  if (f.status) q.set("status", f.status);
  return q.toString();
}

/** A campanha passa no filtro de status? (ativa = ACTIVE; pausada = qualquer pausa.) */
export function statusMatches(status: string | null, f?: AdsStatus): boolean {
  if (!f) return true;
  if (f === "ativas") return status === "ACTIVE";
  return status === "PAUSED" || status === "CAMPAIGN_PAUSED" || status === "ADSET_PAUSED";
}

/** Chave do grupo do dia: o próprio dia, a segunda-feira da semana ou o mês. */
export function groupKey(date: string, g: AdsGroup): string {
  if (g === "mes") return date.slice(0, 7);
  if (g === "semana") {
    const d = new Date(`${date}T12:00:00Z`);
    return shift(date, -((d.getUTCDay() + 6) % 7));
  }
  return date;
}

/** Rótulo do grupo no gráfico: "18/11", "sem. 16/11" ou "nov/26". */
export function groupLabel(key: string, g: AdsGroup): string {
  const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  if (g === "mes") return `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`;
  const dm = `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  return g === "semana" ? `sem. ${dm}` : dm;
}

/** Todos os grupos do período, em ordem (dias sem gasto aparecem com zero). */
export function periodGroups(from: string, to: string, g: AdsGroup): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shift(d, 1)) {
    const k = groupKey(d, g);
    if (out[out.length - 1] !== k) out.push(k);
  }
  return out;
}

/** Variação contra o período anterior; base zero não tem porcentagem. */
export function delta(current: number, previous: number): { pct: number | null; up: boolean } {
  if (previous === 0) return { pct: current === 0 ? 0 : null, up: current >= 0 };
  return { pct: Math.round(((current - previous) / Math.abs(previous)) * 100), up: current >= previous };
}

/** "18 de nov. a 24 de nov." para o subtítulo. */
export function rangeLabel(from: string, to: string): string {
  const f = (d: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  return from === to ? f(from) : `${f(from)} a ${f(to)}`;
}

export { monthEnd };
