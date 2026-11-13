// Repetição de demandas: opções mostradas na tela e o texto de cada uma.

export type RepeatUnit = "dia" | "semana" | "mes";
export type Repeat = { unit: RepeatUnit; every: number } | null;

/** Opções do seletor "Repetir". A chave vai para o formulário; null = não repete. */
export const REPEAT_OPTIONS: { key: string; label: string; value: Repeat }[] = [
  { key: "nao", label: "Não repete", value: null },
  { key: "dia-1", label: "Todo dia", value: { unit: "dia", every: 1 } },
  { key: "semana-1", label: "Toda semana", value: { unit: "semana", every: 1 } },
  { key: "semana-2", label: "A cada 2 semanas", value: { unit: "semana", every: 2 } },
  { key: "mes-1", label: "Todo mês", value: { unit: "mes", every: 1 } },
];

export function repeatKey(unit: string | null | undefined, every: number | null | undefined): string {
  return unit && every ? `${unit}-${every}` : "nao";
}

export function repeatFromKey(key: string): Repeat {
  const m = /^(dia|semana|mes)-(\d{1,2})$/.exec(key);
  return m ? { unit: m[1] as RepeatUnit, every: Number(m[2]) } : null;
}

/** "Toda semana", "A cada 3 semanas", "Todo mês"… */
export function repeatLabel(unit: string | null | undefined, every: number | null | undefined): string | null {
  if (!unit || !every) return null;
  const known = REPEAT_OPTIONS.find((o) => o.value?.unit === unit && o.value.every === every);
  if (known) return known.label;
  const plural = { dia: "dias", semana: "semanas", mes: "meses" }[unit as RepeatUnit] ?? unit;
  return `A cada ${every} ${plural}`;
}

export const WEEKDAY_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const TEMPLATE_CATEGORY_LABEL: Record<string, string> = {
  criativos: "Criativos",
  trafego: "Tráfego",
  conteudo: "Conteúdo",
  site: "Site e landing page",
  copy: "Copy e roteiro",
  reunioes: "Reuniões",
  outros: "Outros",
};
