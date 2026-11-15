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

// Checklists do tráfego (RF-OTI-01 diário, RF-OTI-02 semanal).
export const CHECK_KINDS = ["diario", "semanal"] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];
export const CHECK_STATUSES = ["ok", "problema", "na"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export const CHECK_STATUS_LABEL: Record<CheckStatus, string> = { ok: "Ok", problema: "Problema", na: "Não se aplica" };

export const CHECK_ITEMS: Record<CheckKind, { key: string; label: string; hint: string }[]> = {
  diario: [
    { key: "saldo", label: "Saldo e cobrança", hint: "Saldo para os próximos dias, cartão ou boleto em dia." },
    { key: "reprovados", label: "Anúncios reprovados", hint: "Nenhum anúncio reprovado ou com veiculação limitada." },
    { key: "gasto", label: "Gasto x orçamento", hint: "O gasto de ontem bate com o orçamento e com a verba aprovada." },
    { key: "entrega", label: "Entrega", hint: "Nenhuma campanha ativa sem impressões ou com entrega parada." },
  ],
  semanal: [
    { key: "criativos", label: "Criativos", hint: "Quais seguram resultado e quais cansaram (frequência, CTR)." },
    { key: "publicos", label: "Públicos", hint: "Públicos que funcionam, saturados ou para testar." },
    { key: "custos", label: "Custos", hint: "CPL, custo por conversa e CPM em relação à meta." },
  ],
};

export const DECISION_LEVELS = ["campanha", "conjunto", "anuncio"] as const;
export const DECISION_LEVEL_LABEL: Record<(typeof DECISION_LEVELS)[number], string> = { campanha: "Campanha", conjunto: "Conjunto", anuncio: "Anúncio" };
export const DECISIONS = ["pausar", "manter", "escalar"] as const;
export const DECISION_LABEL: Record<(typeof DECISIONS)[number], string> = { pausar: "Pausar", manter: "Manter", escalar: "Escalar" };

/** Segunda-feira da semana do dia (AAAA-MM-DD), que identifica o checklist semanal. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export type CheckItem = { key: string; status: CheckStatus; note?: string };

/** Itens com problema (rótulo e comentário), na ordem do checklist. */
export function checkProblems(kind: CheckKind, items: CheckItem[]): { label: string; note: string }[] {
  return CHECK_ITEMS[kind].flatMap((d) => {
    const it = items.find((i) => i.key === d.key);
    return it?.status === "problema" ? [{ label: d.label, note: it.note ?? "" }] : [];
  });
}
