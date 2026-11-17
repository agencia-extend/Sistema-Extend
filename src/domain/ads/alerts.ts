// Painel de alertas (RF-ALE-03): tipos, situações e abas.

export type AlertKind = "saldo" | "restricao" | "entrega" | "gasto" | "fadiga" | "reprovado" | "meta_custo" | "meta_ritmo" | "conexao";
export type AlertStatus = "aberto" | "reconhecido" | "resolvido";

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  saldo: "Saldo acabando",
  restricao: "Conta com restrição",
  entrega: "Sem entrega",
  gasto: "Gasto do dia",
  fadiga: "Criativo cansado",
  reprovado: "Anúncio reprovado",
  meta_custo: "Custo acima da meta",
  meta_ritmo: "Ritmo abaixo da meta",
  conexao: "Conexão",
};

export const alertKindLabel = (k: string) => ALERT_KIND_LABEL[k as AlertKind] ?? "Alerta";

export type AlertTab = "abertos" | "reconhecidos" | "resolvidos";
export const ALERT_TABS: { key: AlertTab; label: string; status: AlertStatus }[] = [
  { key: "abertos", label: "Abertos", status: "aberto" },
  { key: "reconhecidos", label: "Reconhecidos", status: "reconhecido" },
  { key: "resolvidos", label: "Resolvidos", status: "resolvido" },
];

export function parseAlertTab(v: string | undefined): AlertTab {
  return ALERT_TABS.some((t) => t.key === v) ? (v as AlertTab) : "abertos";
}

export const tabStatus = (t: AlertTab): AlertStatus => ALERT_TABS.find((x) => x.key === t)!.status;

/** Quem resolveu e como: pessoa (com a nota) ou a verificação automática. */
export function resolvedBy(row: { resolvedById: string | null; resolvedName: string | null }) {
  if (!row.resolvedById) return "Resolvido sozinho";
  return `Resolvido por ${row.resolvedName || "alguém da equipe"}`;
}

/** Limites dos alertas (padrão da agência ou do cliente). */
export type AlertLimits = {
  fundsDays: number;
  fundsMinCents: number | null;
  dailySpendMaxCents: number | null;
  noDelivery: boolean;
  fatigueEnabled: boolean;
  fatigueFrequency: number;
  fatigueCtrDrop: number;
};

export const SYSTEM_LIMITS: AlertLimits = { fundsDays: 3, fundsMinCents: null, dailySpendMaxCents: null, noDelivery: true, fatigueEnabled: true, fatigueFrequency: 3, fatigueCtrDrop: 25 };

/** Resumo de uma linha: "saldo ≤ 3 dias · gasto do dia até R$ 300,00 · fadiga: frequência 3 e CTR −25%". */
export function limitsSummary(l: AlertLimits, brl: (c: number) => string): string {
  const parts: string[] = [];
  const funds = [l.fundsDays > 0 ? `${l.fundsDays} ${l.fundsDays === 1 ? "dia" : "dias"} ou menos` : null, l.fundsMinCents ? `abaixo de ${brl(l.fundsMinCents)}` : null].filter(Boolean);
  parts.push(funds.length ? `saldo ${funds.join(" ou ")}` : "sem aviso de saldo");
  if (l.dailySpendMaxCents) parts.push(`gasto do dia acima de ${brl(l.dailySpendMaxCents)}`);
  if (!l.noDelivery) parts.push("sem aviso de entrega parada");
  parts.push(l.fatigueEnabled ? `fadiga com frequência ${String(l.fatigueFrequency).replace(".", ",")} e CTR ${l.fatigueCtrDrop}% menor` : "sem aviso de fadiga");
  return parts.join(" · ");
}
