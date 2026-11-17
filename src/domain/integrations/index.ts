// Regras puras das conexões com a Meta e o Google (sem chamadas de rede).

export type Provider = "meta" | "google";
export type Purpose = "ads" | "calendar";
export type OwnerKind = "agency" | "user" | "client";

/** O que cada conexão precisa no servidor. Os nomes são os das variáveis de ambiente. */
export const REQUIRED_ENV: Record<Provider, readonly string[]> = {
  meta: ["META_APP_ID", "META_APP_SECRET", "TOKEN_ENCRYPTION_KEY", "SUPABASE_SECRET_KEY"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY", "SUPABASE_SECRET_KEY"],
};

/** Variáveis que faltam (vazias ou só com espaço/aspas). */
export function missingEnv(provider: Provider, env: Record<string, string | undefined>): string[] {
  return REQUIRED_ENV[provider].filter((k) => !(env[k] ?? "").trim().replace(/^["']|["']$/g, ""));
}

/** Conta de anúncio da Meta sempre com o prefixo act_. */
export function metaAccountId(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits ? `act_${digits}` : "";
}

/** Customer ID do Google Ads no formato da tela (123-456-7890). */
export function googleCustomerId(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d;
}

const digits = (v: string) => v.replace(/\D/g, "");

/**
 * Cliente sugerido para uma conta encontrada: o que já tem essa conta em "Contas e acessos".
 * Compara só os dígitos (act_123 = 123; 123-456-7890 = 1234567890).
 */
export function suggestClient(
  account: { provider: Provider; externalId: string },
  clientAccounts: { clientId: string; kind: string; value: string }[],
): string | null {
  const kind = account.provider === "meta" ? "ad_account_meta" : "ad_account_google";
  const id = digits(account.externalId);
  if (!id) return null;
  const hits = new Set(clientAccounts.filter((a) => a.kind === kind && digits(a.value) === id).map((a) => a.clientId));
  return hits.size === 1 ? [...hits][0] : null;
}

const META_ACCOUNT_STATUS: Record<number, string> = {
  1: "Ativa",
  2: "Desativada",
  3: "Pagamento pendente",
  7: "Em análise",
  8: "Pagamento pendente",
  9: "Em período de carência",
  100: "Encerramento pendente",
  101: "Encerrada",
};
export const metaAccountStatus = (code: number | undefined) => (code === undefined ? null : (META_ACCOUNT_STATUS[code] ?? `Situação ${code}`));

const GOOGLE_STATUS: Record<string, string> = { ENABLED: "Ativa", CANCELED: "Cancelada", SUSPENDED: "Suspensa", CLOSED: "Encerrada" };
export const googleAccountStatus = (s: string | null | undefined) => (s ? (GOOGLE_STATUS[s] ?? s) : null);

/** Erro da Graph API da Meta em português, com o que fazer. */
export function metaErrorMessage(code: number | undefined, subcode?: number): { message: string; expired: boolean } {
  if (code === 190 || subcode === 463 || subcode === 460)
    return { message: "A conexão com a Meta expirou ou foi revogada. Conecte de novo.", expired: true };
  if (code === 10 || code === 200 || code === 294)
    return { message: "Falta permissão no app da Meta para esta consulta. Confira as permissões da configuração do login (ads_read e business_management).", expired: false };
  if (code === 4 || code === 17 || code === 32 || code === 613)
    return { message: "A Meta limitou as consultas por alguns minutos. Tente de novo mais tarde.", expired: false };
  return { message: "A Meta recusou a consulta. Tente de novo; se continuar, reconecte.", expired: false };
}

/** Erro do Google (OAuth ou Google Ads API) em português, com o que fazer. */
export function googleErrorMessage(reason: string | undefined, status?: number): { message: string; expired: boolean } {
  if (reason === "invalid_grant" || status === 401)
    return { message: "A conexão com o Google expirou ou foi revogada. Conecte de novo.", expired: true };
  if (reason === "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION" || reason === "DEVELOPER_TOKEN_NOT_APPROVED")
    return { message: "O projeto do Google Cloud ainda está no nível de teste da Google Ads API. Peça o acesso Explorer ou Basic no Google Ads API Center.", expired: false };
  if (reason === "USER_PERMISSION_DENIED")
    return { message: "A conta Google conectada não tem acesso a esta conta de anúncio. Conecte com o e-mail que administra a MCC.", expired: false };
  if (reason === "SERVICE_DISABLED" || status === 403)
    return { message: "A API não está ativada no projeto do Google Cloud. Ative a Google Ads API (e a Google Calendar API) na biblioteca de APIs.", expired: false };
  if (status === 429 || reason === "RESOURCE_EXHAUSTED")
    return { message: "O Google limitou as consultas por alguns minutos. Tente de novo mais tarde.", expired: false };
  return { message: "O Google recusou a consulta. Tente de novo; se continuar, reconecte.", expired: false };
}

/** Rótulo da situação mostrado na tela. */
export function connectionLabel(c: { status: string; expiresAt: string | null; hasRefresh?: boolean }, now = Date.now()): string {
  if (c.status === "error") return "Com erro";
  if (c.status === "expired" || (c.expiresAt && new Date(c.expiresAt).getTime() < now && !c.hasRefresh)) return "Expirada";
  if (c.expiresAt && !c.hasRefresh) {
    const days = Math.ceil((new Date(c.expiresAt).getTime() - now) / 86_400_000);
    if (days <= 7) return `Vence em ${days} ${days === 1 ? "dia" : "dias"}`;
  }
  return "Conectada";
}

/** Corpo do evento na Google Agenda a partir do evento do sistema (horário de São Paulo). */
export function googleEventBody(e: { title: string; startsAt: string; endsAt: string; location: string | null; link: string | null; notes: string | null; clientName?: string | null; url: string }) {
  const lines = [e.clientName ? `Cliente: ${e.clientName}` : null, e.notes, e.link ? `Link: ${e.link}` : null, `Aberto no Sistema Extend: ${e.url}`].filter(Boolean);
  return {
    summary: e.title,
    description: lines.join("\n\n"),
    location: e.location ?? undefined,
    start: { dateTime: new Date(e.startsAt).toISOString(), timeZone: "America/Sao_Paulo" },
    end: { dateTime: new Date(e.endsAt).toISOString(), timeZone: "America/Sao_Paulo" },
    source: { title: "Sistema Extend", url: e.url },
  };
}
