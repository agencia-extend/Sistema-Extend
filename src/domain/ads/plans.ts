// Plano de campanha (RF-PLA-01/02): situação, objetivo, orçamento planejado e o ritmo do gasto real. Sem rede.

export const PLAN_STATUSES = ["rascunho", "aprovado", "no_ar", "encerrado"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = { rascunho: "Rascunho", aprovado: "Aprovado pelo cliente", no_ar: "No ar", encerrado: "Encerrado" };

export const PLAN_OBJECTIVES = ["leads", "mensagens", "vendas", "trafego", "engajamento", "alcance", "reconhecimento", "seguidores", "video"] as const;
export type PlanObjective = (typeof PLAN_OBJECTIVES)[number];
export const PLAN_OBJECTIVE_LABEL: Record<PlanObjective, string> = {
  leads: "Leads (cadastros)",
  mensagens: "Mensagens",
  vendas: "Vendas",
  trafego: "Tráfego para o site",
  engajamento: "Engajamento",
  alcance: "Alcance",
  reconhecimento: "Reconhecimento",
  seguidores: "Seguidores",
  video: "Visualizações de vídeo",
};

export const PLAN_PLATFORMS = ["meta", "google"] as const;
export type PlanPlatform = (typeof PLAN_PLATFORMS)[number];
export const PLAN_PLATFORM_LABEL: Record<PlanPlatform, string> = { meta: "Meta Ads", google: "Google Ads" };

/** A peça {OBJETIVO} do nome padrão para este objetivo. */
export const objectiveToken = (o: PlanObjective) => o.toUpperCase();

const DAY = 86_400_000;
const toDay = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));

/** Dias corridos entre as datas (inclusive). */
export function daysBetween(start: string, end: string): number {
  return Math.max(0, Math.round((toDay(end) - toDay(start)) / DAY) + 1);
}

/** Orçamento total previsto: o total, ou o diário vezes os dias. Sem data de fim, diário não tem total. */
export function plannedTotalCents(p: { budgetType: "diario" | "total"; budgetCents: number; startDate: string; endDate: string | null }): number | null {
  if (p.budgetType === "total") return p.budgetCents;
  return p.endDate ? p.budgetCents * daysBetween(p.startDate, p.endDate) : null;
}

/** Até onde o gasto conta: hoje, ou o fim do plano se já passou. Antes do início, nada. */
export function spendWindow(startDate: string, endDate: string | null, today: string): { start: string; end: string } | null {
  if (today < startDate) return null;
  return { start: startDate, end: endDate && endDate < today ? endDate : today };
}

export type Pace = { tone: "ok" | "acima" | "abaixo"; label: string };

/**
 * Ritmo do gasto: compara o que já gastou com o previsto até agora (o diário vezes os dias corridos, ou o total
 * proporcional aos dias). Tolerância de 15%. Sem previsão (diário sem fim usa o diário) ou antes do início: nada.
 */
export function planPace(
  p: { budgetType: "diario" | "total"; budgetCents: number; startDate: string; endDate: string | null },
  spentCents: number,
  today: string,
): Pace | null {
  const w = spendWindow(p.startDate, p.endDate, today);
  if (!w) return null;
  const elapsed = daysBetween(w.start, w.end);
  let expected: number;
  if (p.budgetType === "diario") expected = p.budgetCents * elapsed;
  else {
    if (!p.endDate) return null;
    expected = (p.budgetCents * elapsed) / daysBetween(p.startDate, p.endDate);
  }
  if (expected <= 0) return null;
  const ratio = spentCents / expected;
  const pct = Math.round(ratio * 100);
  if (ratio > 1.15) return { tone: "acima", label: `Gastando acima do previsto (${pct}% do esperado até agora)` };
  if (ratio < 0.85) return { tone: "abaixo", label: `Gastando abaixo do previsto (${pct}% do esperado até agora)` };
  return { tone: "ok", label: `No ritmo do previsto (${pct}% do esperado até agora)` };
}

/** Situações que a pessoa pode escolher a partir da atual (no ar também entra sozinho pela campanha ativa). */
export function nextStatuses(s: PlanStatus): PlanStatus[] {
  switch (s) {
    case "rascunho": return ["aprovado"];
    case "aprovado": return ["no_ar", "rascunho", "encerrado"];
    case "no_ar": return ["encerrado"];
    case "encerrado": return ["no_ar"];
  }
}
