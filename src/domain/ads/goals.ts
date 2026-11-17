// Metas de anúncios do mês (RF-T2-04): progresso até ontem e projeção para o mês inteiro no ritmo atual.

export type GoalKind = "leads" | "messages" | "purchases" | "link_clicks";
export const GOAL_KINDS: GoalKind[] = ["leads", "messages", "purchases", "link_clicks"];
export const GOAL_KIND_LABEL: Record<GoalKind, { many: string; one: string }> = {
  leads: { one: "lead", many: "Leads" },
  messages: { one: "conversa", many: "Conversas" },
  purchases: { one: "compra", many: "Compras" },
  link_clicks: { one: "clique", many: "Cliques no link" },
};

export type Goal = { resultKind: GoalKind; resultsTarget: number | null; spendCents: number | null; maxCostCents: number | null; minRoas: number | null };
export type MonthActual = { spendCents: number; results: number; purchaseValueCents: number };

export type GoalLine = {
  key: "results" | "spend" | "cost" | "roas";
  label: string;
  target: number;
  actual: number | null;
  projected: number | null;
  /** 0–1+ do alvo (para a barra). */
  ratio: number | null;
  state: "ok" | "atencao" | "sem_dados";
  /** Quanto maior, melhor? (custo: menor é melhor). */
  higherIsBetter: boolean;
};

/** Dias do mês e dias completos (até ontem) a partir de hoje (São Paulo). */
export function monthDays(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { days, elapsed: d - 1 };
}

/**
 * Linhas de meta com projeção linear (valor ÷ dias completos × dias do mês). Antes de 3 dias completos,
 * a projeção não é mostrada (pouco dado). Investimento fora de ±15% do planejado também pede atenção.
 */
export function goalLines(goal: Goal, actual: MonthActual, today: string): GoalLine[] {
  const { days, elapsed } = monthDays(today);
  const project = (v: number) => (elapsed >= 3 ? Math.round((v / elapsed) * days) : null);
  const lines: GoalLine[] = [];
  if (goal.resultsTarget) {
    const projected = project(actual.results);
    lines.push({
      key: "results", label: GOAL_KIND_LABEL[goal.resultKind].many, target: goal.resultsTarget, actual: actual.results, projected,
      ratio: actual.results / goal.resultsTarget, higherIsBetter: true,
      state: projected === null ? "sem_dados" : projected >= goal.resultsTarget * 0.8 ? "ok" : "atencao",
    });
  }
  if (goal.spendCents) {
    const projected = project(actual.spendCents);
    lines.push({
      key: "spend", label: "Investimento", target: goal.spendCents, actual: actual.spendCents, projected,
      ratio: actual.spendCents / goal.spendCents, higherIsBetter: true,
      state: projected === null ? "sem_dados" : Math.abs(projected - goal.spendCents) <= goal.spendCents * 0.15 ? "ok" : "atencao",
    });
  }
  if (goal.maxCostCents) {
    const cost = actual.results ? Math.round(actual.spendCents / actual.results) : null;
    lines.push({
      key: "cost", label: `Custo por ${GOAL_KIND_LABEL[goal.resultKind].one}`, target: goal.maxCostCents, actual: cost, projected: null,
      ratio: cost === null ? null : cost / goal.maxCostCents, higherIsBetter: false,
      state: cost === null ? "sem_dados" : cost <= goal.maxCostCents ? "ok" : "atencao",
    });
  }
  if (goal.minRoas) {
    const roas = actual.spendCents ? actual.purchaseValueCents / actual.spendCents : null;
    lines.push({
      key: "roas", label: "ROAS", target: goal.minRoas, actual: roas, projected: null,
      ratio: roas === null ? null : roas / goal.minRoas, higherIsBetter: true,
      state: roas === null || actual.spendCents === 0 ? "sem_dados" : roas >= goal.minRoas ? "ok" : "atencao",
    });
  }
  return lines;
}
