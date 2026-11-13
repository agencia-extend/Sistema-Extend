// Painel operacional (prompt ERP 3.1): números do momento e do período, para a gestão.

export type OpsPeriod = "hoje" | "semana" | "mes" | "todos";
export const OPS_PERIOD_LABEL: Record<OpsPeriod, string> = { hoje: "Hoje", semana: "Esta semana", mes: "Este mês", todos: "Tudo" };

export type OpsTask = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueAt: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  clientId: string | null;
  clientName: string | null;
};

const OPEN = (s: string) => s !== "concluido" && s !== "cancelado";
const SP = 3 * 3600_000;

/** Início do período em São Paulo (semana começa na segunda), como instante ISO. null = sem limite. */
export function periodStart(p: OpsPeriod, now: Date = new Date()): string | null {
  if (p === "todos") return null;
  const sp = new Date(now.getTime() - SP);
  let y = sp.getUTCFullYear();
  let m = sp.getUTCMonth();
  let d = sp.getUTCDate();
  if (p === "mes") d = 1;
  if (p === "semana") {
    const dow = (sp.getUTCDay() + 6) % 7; // 0 = segunda
    const start = new Date(Date.UTC(y, m, d - dow));
    y = start.getUTCFullYear();
    m = start.getUTCMonth();
    d = start.getUTCDate();
  }
  return new Date(Date.UTC(y, m, d) + SP).toISOString();
}

export type OpsSummary = {
  kpis: { doing: number; review: number; done: number; late: number; unassigned: number };
  urgent: OpsTask[];
  byType: { type: string; count: number }[];
  people: { id: string; name: string; open: number; late: number; done: number }[];
};

/**
 * @param tasks demandas em aberto + concluídas desde o início do período
 * @param personId filtra tudo por responsável (null = equipe toda)
 */
export function summarize(tasks: OpsTask[], period: OpsPeriod, personId: string | null, now: Date = new Date()): OpsSummary {
  const nowIso = now.toISOString();
  const since = periodStart(period, now);
  const mine = personId ? tasks.filter((t) => t.assigneeId === personId) : tasks;
  const open = mine.filter((t) => OPEN(t.status));
  const late = (t: OpsTask) => Boolean(t.dueAt && t.dueAt < nowIso && OPEN(t.status));
  const doneInPeriod = mine.filter((t) => t.status === "concluido" && t.completedAt && (!since || t.completedAt >= since));

  const rank = (t: OpsTask) => (late(t) ? 0 : t.priority === "urgente" ? 1 : 2);
  const urgent = open
    .filter((t) => late(t) || t.priority === "urgente" || t.priority === "alta")
    .sort((a, b) => rank(a) - rank(b) || (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"))
    .slice(0, 8);

  const types = new Map<string, number>();
  for (const t of doneInPeriod) types.set(t.type, (types.get(t.type) ?? 0) + 1);

  const people = new Map<string, { id: string; name: string; open: number; late: number; done: number }>();
  for (const t of tasks) {
    if (!t.assigneeId) continue;
    const p = people.get(t.assigneeId) ?? { id: t.assigneeId, name: t.assigneeName ?? "Sem nome", open: 0, late: 0, done: 0 };
    if (OPEN(t.status)) p.open++;
    if (late(t)) p.late++;
    if (t.status === "concluido" && t.completedAt && (!since || t.completedAt >= since)) p.done++;
    people.set(t.assigneeId, p);
  }

  return {
    kpis: {
      doing: open.filter((t) => t.status === "em_andamento").length,
      review: open.filter((t) => t.status === "aguardando_aprovacao").length,
      done: doneInPeriod.length,
      late: open.filter(late).length,
      unassigned: open.filter((t) => !t.assigneeId).length,
    },
    urgent,
    byType: [...types].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    people: [...people.values()].sort((a, b) => b.late - a.late || b.open - a.open || a.name.localeCompare(b.name)),
  };
}
