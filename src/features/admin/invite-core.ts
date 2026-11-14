import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { formatDateTime } from "@/domain/shared/dates";

/** Núcleo do convite (equipe e área do cliente): código, prazo, conta pendente e e-mail do Supabase. */
export const INVITE_DAYS = 7;
export const SECRET_MISSING = "Convites ainda não estão configurados no servidor (falta SUPABASE_SECRET_KEY). Avise o responsável técnico.";

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const acceptUrl = (token: string) => `${publicEnv.NEXT_PUBLIC_SITE_URL}/convite/${token}`;
export const expiresAt = () => new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();

export type InvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role_id: string | null;
  portal_client_id: string | null;
  status: "pendente" | "aceito" | "cancelado";
  expires_at: string;
  user_id: string | null;
  send_count: number;
};

/**
 * Cria a conta no Auth (perfil inativo até o aceite) e dispara o e-mail do Supabase.
 * Os campos de `data` alimentam o modelo "invite" de scripts/email-templates.mjs.
 */
export async function sendInvite(inv: InvitationRow, token: string, ctx: { inviterName: string; roleName: string }) {
  return createAdminClient().auth.admin.inviteUserByEmail(inv.email, {
    redirectTo: acceptUrl(token),
    data: {
      invitation_id: inv.id,
      role_id: inv.role_id,
      full_name: inv.full_name,
      invite_url: acceptUrl(token),
      inviter_name: ctx.inviterName,
      role_name: ctx.roleName,
      expires_label: formatDateTime(inv.expires_at),
    },
  });
}

/** Remove a conta criada pelo convite, apenas se ela nunca foi ativada. */
export async function removePendingAccount(userId: string | null) {
  if (!userId) return;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("is_active").eq("id", userId).maybeSingle();
  if (!profile || profile.is_active) return;
  await admin.auth.admin.deleteUser(userId);
}

/** Erro do Supabase ao enviar o convite → mensagem para a tela. */
export function inviteErrorMessage(error: { code?: string; status?: number; message?: string } | null): { code: "conflict" | "business_rule" | "unknown"; message: string } {
  if (error?.code === "email_exists" || /already been registered/i.test(error?.message ?? "")) return { code: "conflict", message: "Este e-mail já tem uma conta no sistema." };
  if (error?.status === 429) return { code: "business_rule", message: "Limite de e-mails do servidor atingido. Tente novamente em alguns minutos." };
  return { code: "unknown", message: "Não foi possível enviar o convite agora. Tente novamente." };
}
