"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { RATE_LIMIT_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { fail, ok } from "@/domain/shared/result";
import { sendEmail } from "@/lib/email/send";
import { portalAccessEmail } from "@/lib/email/messages";
import { SECRET_MISSING, expiresAt, hashToken, inviteErrorMessage, newToken, removePendingAccount, sendInvite, type InvitationRow } from "@/features/admin/invite-core";
import { portalDecisionSchema, portalInvitationIdSchema, portalInviteSchema, portalUserActiveSchema, strategySchema } from "./schemas";

const page = (clientId: string) => `/clientes/${clientId}/area-do-cliente`;
const NO_PERMISSION = "Você não tem permissão para gerenciar a área deste cliente.";

async function canManage(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_portal", { p_client: clientId });
  return data === true;
}

async function clientName(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
  return data?.name ?? "";
}

/** Convida uma pessoa do cliente (RF-ACL-01): mesmo fluxo do convite da equipe, sem papel, ligada a um cliente. */
export const invitePortalUser = defineAction({ schema: portalInviteSchema }, async ({ clientId, email, fullName }, { user }) => {
  if (!process.env.SUPABASE_SECRET_KEY) return fail("business_rule", SECRET_MISSING);
  if (!(await canManage(clientId))) return fail("forbidden", NO_PERMISSION);
  if (!(await withinRateLimit(`invite:${user.id}`, 30, 3600))) return fail("business_rule", RATE_LIMIT_MESSAGE);

  const admin = createAdminClient();
  const [{ data: existing }, { data: pending }] = await Promise.all([
    admin.from("profiles").select("id, portal_client_id").eq("email", email).maybeSingle(),
    admin.from("invitations").select("id").eq("email", email).eq("status", "pendente").maybeSingle(),
  ]);
  if (pending) return fail("conflict", "Já existe um convite pendente para este e-mail. Use “Reenviar”.");
  if (existing) {
    return fail("conflict", existing.portal_client_id === clientId ? "Esta pessoa já tem acesso à área deste cliente." : "Este e-mail já tem acesso ao sistema. Use outro e-mail.");
  }

  const name = await clientName(clientId);
  if (!name) return fail("not_found", "Cliente não encontrado.");
  const token = newToken();
  const inv = must(
    await admin
      .from("invitations")
      .insert({ organization_id: user.organizationId, email, full_name: fullName, role_id: null, portal_client_id: clientId, token_hash: hashToken(token), expires_at: expiresAt(), invited_by: user.id })
      .select("*")
      .single(),
  ) as InvitationRow;

  const { data, error } = await sendInvite(inv, token, { inviterName: user.fullName, roleName: `Área do cliente de ${name}` });
  if (error || !data.user) {
    await admin.from("invitations").delete().eq("id", inv.id);
    const m = inviteErrorMessage(error);
    if (m.code === "unknown") console.error("[invitePortalUser]", error?.code ?? error?.status);
    return fail(m.code, m.message);
  }
  await admin.from("invitations").update({ user_id: data.user.id }).eq("id", inv.id);
  revalidatePath(page(clientId));
  return ok(null, `Convite enviado para ${email}.`);
});

async function portalInvitation(clientId: string, id: string) {
  const { data } = await createAdminClient().from("invitations").select("*").eq("id", id).eq("portal_client_id", clientId).maybeSingle();
  return data as InvitationRow | null;
}

export const resendPortalInvite = defineAction({ schema: portalInvitationIdSchema }, async ({ clientId, id }, { user }) => {
  if (!process.env.SUPABASE_SECRET_KEY) return fail("business_rule", SECRET_MISSING);
  if (!(await canManage(clientId))) return fail("forbidden", NO_PERMISSION);
  if (!(await withinRateLimit(`invite:${user.id}`, 30, 3600))) return fail("business_rule", RATE_LIMIT_MESSAGE);
  const inv = await portalInvitation(clientId, id);
  if (!inv) return fail("not_found", "Convite não encontrado.");
  if (inv.status !== "pendente") return fail("business_rule", "Só convites pendentes podem ser reenviados.");

  await removePendingAccount(inv.user_id);
  const token = newToken();
  const admin = createAdminClient();
  const updated = must(
    await admin
      .from("invitations")
      .update({ token_hash: hashToken(token), expires_at: expiresAt(), send_count: inv.send_count + 1, last_sent_at: new Date().toISOString(), user_id: null })
      .eq("id", id)
      .select("*")
      .single(),
  ) as InvitationRow;
  const { data, error } = await sendInvite(updated, token, { inviterName: user.fullName, roleName: `Área do cliente de ${await clientName(clientId)}` });
  if (error || !data.user) {
    console.error("[resendPortalInvite]", error?.code ?? error?.status);
    return fail("unknown", "Não foi possível reenviar o convite agora. Tente novamente.");
  }
  await admin.from("invitations").update({ user_id: data.user.id }).eq("id", id);
  revalidatePath(page(clientId));
  return ok(null, `Convite reenviado para ${updated.email}.`);
});

export const cancelPortalInvite = defineAction({ schema: portalInvitationIdSchema }, async ({ clientId, id }, { user }) => {
  if (!process.env.SUPABASE_SECRET_KEY) return fail("business_rule", SECRET_MISSING);
  if (!(await canManage(clientId))) return fail("forbidden", NO_PERMISSION);
  const inv = await portalInvitation(clientId, id);
  if (!inv) return fail("not_found", "Convite não encontrado.");
  if (inv.status !== "pendente") return fail("business_rule", "Este convite não está mais pendente.");
  must(
    await createAdminClient()
      .from("invitations")
      .update({ status: "cancelado", cancelled_at: new Date().toISOString(), cancelled_by: user.id })
      .eq("id", id)
      .eq("status", "pendente"),
  );
  await removePendingAccount(inv.user_id);
  revalidatePath(page(clientId));
  return ok(null, "Convite revogado. O link deixou de funcionar.");
});

/** Pausa ou reativa o acesso de uma pessoa do cliente: a sessão cai em todos os aparelhos e ela é avisada por e-mail. */
export const setPortalUserActive = defineAction({ schema: portalUserActiveSchema }, async ({ clientId, userId, active }) => {
  const supabase = await createClient();
  must(await supabase.rpc("set_portal_user_active", { p_user: userId, p_active: active }));
  if (process.env.SUPABASE_SECRET_KEY) {
    await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  }
  const { data: person } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
  let mail: Awaited<ReturnType<typeof sendEmail>> = "skipped";
  if (person) {
    const m = portalAccessEmail(publicEnv.NEXT_PUBLIC_SITE_URL, { name: person.full_name || person.email, email: person.email }, active, await clientName(clientId));
    mail = await sendEmail(person.email, m.subject, m.parts);
  }
  revalidatePath(page(clientId));
  const warn = mail === "failed" ? " O e-mail de aviso não pôde ser enviado; avise a pessoa por outro canal." : mail === "sent" ? " A pessoa foi avisada por e-mail." : "";
  return ok(null, (active ? "Acesso reativado." : "Acesso pausado. A pessoa foi desconectada.") + warn);
});

/** Estratégia/planejamento: salva o rascunho e, se pedido, publica para o cliente (que é avisado). */
export const saveStrategy = defineAction({ schema: strategySchema }, async ({ clientId, body, publish }) => {
  const supabase = await createClient();
  must(await supabase.rpc("save_client_strategy", { p_client: clientId, p_body: body, p_publish: publish }));
  revalidatePath(page(clientId));
  return ok(null, publish ? "Estratégia publicada. As pessoas do cliente foram avisadas." : "Rascunho salvo. O cliente ainda vê a versão publicada.");
});

/** Aprovação pela área do cliente (mesmo fluxo do link): só a pessoa do cliente decide. */
export const decideInPortal = defineAction({ schema: portalDecisionSchema }, async ({ taskId, decision, comment }) => {
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_decide", { p_task: taskId, p_decision: decision, p_comment: comment });
  if (error) {
    if (error.code === "P0001") return fail("business_rule", error.message);
    if (error.code === "42501") return fail("forbidden", error.message);
    if (error.code === "P0002") return fail("not_found", "Conteúdo não encontrado.");
    console.error("[decideInPortal]", error.code);
    return fail("unknown", "Não foi possível registrar a decisão agora. Tente de novo em instantes.");
  }
  revalidatePath("/portal", "layout");
  return ok(null, decision === "aprovado" ? "Aprovado! A equipe já foi avisada." : "Pedido de alteração enviado para a equipe.");
});
