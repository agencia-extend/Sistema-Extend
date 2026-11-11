export const ENTITY_LABEL: Record<string, string> = {
  profiles: "usuário",
  user_roles: "papel de usuário",
  user_permission_overrides: "exceção de permissão",
  role_permissions: "permissão de papel",
  roles: "papel",
  profile_sectors: "setor de usuário",
  sectors: "setor",
  invitations: "convite",
  organizations: "empresa",
};

export const ACTION_LABEL: Record<string, string> = {
  insert: "criou",
  update: "alterou",
  delete: "excluiu",
  soft_delete: "arquivou",
  restore: "restaurou",
  invitation_accepted: "aceitou o",
  test_notification: "enviou notificação de teste para",
};

export const PERIODS: Record<string, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  tudo: "Tudo",
};

export function periodStart(period: string, now = new Date()): Date | null {
  if (period === "tudo") return null;
  if (period === "hoje") {
    // Meia-noite em São Paulo (UTC-3, sem horário de verão desde 2019).
    const sp = new Date(now.getTime() - 3 * 3600_000);
    return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 3));
  }
  const days = Number(period.replace("d", "")) || 30;
  return new Date(now.getTime() - days * 86_400_000);
}
