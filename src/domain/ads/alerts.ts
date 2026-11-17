// Painel de alertas (RF-ALE-03): tipos, situações e abas.

export type AlertKind = "saldo" | "restricao" | "entrega" | "reprovado" | "meta_custo" | "meta_ritmo" | "conexao";
export type AlertStatus = "aberto" | "reconhecido" | "resolvido";

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  saldo: "Saldo acabando",
  restricao: "Conta com restrição",
  entrega: "Sem entrega",
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
