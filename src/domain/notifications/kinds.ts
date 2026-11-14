// Tipos de notificação (RF-NOT-04). A chave é gravada em notifications.kind.
export const NOTIFICATION_KINDS = [
  { key: "assigned", label: "Uma demanda foi atribuída a mim" },
  { key: "stage_changed", label: "A etapa de uma demanda minha mudou" },
  { key: "comment", label: "Comentários e menções" },
  { key: "due_soon", label: "Prazo nas próximas 24 horas" },
  { key: "overdue", label: "Demanda atrasada" },
  { key: "client_approval", label: "Aprovação do cliente recebida" },
  { key: "creative_ready", label: "Criativo pronto" },
  { key: "ad_alert", label: "Alertas de anúncios" },
  { key: "client_onboarding", label: "Cliente novo em onboarding" },
  { key: "training", label: "Treinamento atribuído, atrasado ou concluído" },
  { key: "crm", label: "Comercial: próximas ações e leads parados" },
  { key: "proposal", label: "Propostas: aberta pelo cliente, aceita ou vencida" },
  { key: "privacy", label: "Pedidos sobre dados pessoais (LGPD) e respostas" },
  { key: "system", label: "Avisos do sistema e testes" },
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]["key"];

export function isNotificationKind(value: string): value is NotificationKind {
  return NOTIFICATION_KINDS.some((k) => k.key === value);
}
