// Registro de alterações do tráfego e aprovações de verba (RF-OTI-03, RF-T2-03).

export const CHANGE_CATEGORIES = ["orcamento", "campanha", "publico", "criativo", "lance", "pausa", "ativacao", "rastreamento", "outro"] as const;
export type ChangeCategory = (typeof CHANGE_CATEGORIES)[number];
export const CHANGE_CATEGORY_LABEL: Record<ChangeCategory, string> = {
  orcamento: "Orçamento",
  campanha: "Campanha nova ou estrutura",
  publico: "Público",
  criativo: "Criativo",
  lance: "Lance ou otimização",
  pausa: "Pausa",
  ativacao: "Ativação",
  rastreamento: "Pixel, eventos ou rastreamento",
  outro: "Outra",
};

export const PLATFORMS = ["meta", "google", "outra"] as const;
export const PLATFORM_LABEL: Record<string, string> = { meta: "Meta", google: "Google Ads", outra: "Outra", todas: "Meta e Google" };

export const BUDGET_PLATFORMS = ["meta", "google", "todas"] as const;
export const BUDGET_CHANNELS = ["whatsapp", "email", "reuniao", "ligacao", "outro"] as const;
export type BudgetChannel = (typeof BUDGET_CHANNELS)[number];
export const BUDGET_CHANNEL_LABEL: Record<BudgetChannel, string> = { whatsapp: "WhatsApp", email: "E-mail", reuniao: "Reunião", ligacao: "Ligação", outro: "Outro" };

/** Verba vigente na data (a de período mais recente que cobre o dia). */
export function currentBudget<T extends { periodStart: string; periodEnd: string }>(list: T[], day: string): T | null {
  return [...list].filter((b) => b.periodStart <= day && b.periodEnd >= day).sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0] ?? null;
}

/** Quantos dias tem o período (inclusive) e a verba média por dia, em centavos. */
export function dailyBudget(amountCents: number, start: string, end: string): { days: number; perDayCents: number } {
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
  return { days, perDayCents: days > 0 ? Math.round(amountCents / days) : 0 };
}

/** Agrupa registros por mês (AAAA-MM), na ordem em que vieram. */
export function byMonth<T extends { happenedOn: string }>(list: T[]): { month: string; items: T[] }[] {
  const out: { month: string; items: T[] }[] = [];
  for (const it of list) {
    const m = it.happenedOn.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.month === m) last.items.push(it);
    else out.push({ month: m, items: [it] });
  }
  return out;
}
