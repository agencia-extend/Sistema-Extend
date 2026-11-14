"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { clientIp, RATE_LIMIT_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { fail, ok, type ActionResult } from "@/domain/shared/result";
import { acceptInvitationSchema } from "@/features/auth/schemas";
import { sendEmail } from "@/lib/email/send";
import { portalWelcomeEmail, welcomeEmail } from "@/lib/email/messages";
import { PRIVACY_VERSION } from "@/domain/privacy";
import { invitationIdSchema, inviteSchema } from "./schemas";
import { SECRET_MISSING, expiresAt, hashToken, newToken, removePendingAccount, sendInvite, type InvitationRow } from "./invite-core";

async function inviteContext(roleId: string, inviterName: string) {
  const supabase = await createClient();
  // Pela RLS: confirma que o papel é desta organização.
  const role = must(await supabase.from("roles").select("key, name").eq("id", roleId).single()) as { key: string; name: string };
  return { roleKey: role.key, roleName: role.name, inviterName };
}

export const inviteUser = defineAction({ schema: inviteSchema, permission: "users.manage" }, async (input, { user }) => {
  if (!process.env.SUPABASE_SECRET_KEY) return fail("business_rule", SECRET_MISSING);
  if (!(await withinRateLimit(`invite:${user.id}`, 30, 3600))) return fail("business_rule", RATE_LIMIT_MESSAGE);

  const supabase = await createClient();
  const { data: member } = await supabase.from("profiles").select("id, is_active").eq("email", input.email).maybeSingle();
  if (member?.is_active) return fail("conflict", "Esta pessoa já tem acesso ao sistema.");
  if (member && !member.is_active) {
    const { data: pend } = await supabase.from("invitations").select("id").eq("email", input.email).eq("status", "pendente").maybeSingle();
    if (!pend) return fail("conflict", "Esta pessoa está desativada. Reative o acesso na lista de usuários.");
  }
  const { data: pending } = await supabase.from("invitations").select("id").eq("email", input.email).eq("status", "pendente").maybeSingle();
  if (pending) return fail("conflict", "Já existe um convite pendente para este e-mail. Use “Reenviar”.");

  const ctx = await inviteContext(input.roleId, user.fullName);
  if (ctx.roleKey === "admin" && !user.isAdmin) return fail("forbidden", "Somente um administrador convida outro administrador.");

  const token = newToken();
  const admin = createAdminClient();
  const inv = must(
    await admin
      .from("invitations")
      .insert({
        organization_id: user.organizationId,
        email: input.email,
        full_name: input.fullName,
        role_id: input.roleId,
        sector_ids: input.sectorIds,
        token_hash: hashToken(token),
        expires_at: expiresAt(),
        invited_by: user.id,
      })
      .select("*")
      .single(),
  ) as InvitationRow;

  const { data, error } = await sendInvite(inv, token, ctx);
  if (error || !data.user) {
    await admin.from("invitations").delete().eq("id", inv.id);
    if (error?.code === "email_exists" || /already been registered/i.test(error?.message ?? "")) {
      return fail("conflict", "Este e-mail já tem uma conta no sistema.");
    }
    if (error?.status === 429) return fail("business_rule", "Limite de e-mails do servidor atingido. Tente novamente em alguns minutos.");
    console.error("[inviteUser]", error?.code ?? error?.status);
    return fail("unknown", "Não foi possível enviar o convite agora. Tente novamente.");
  }
  await admin.from("invitations").update({ user_id: data.user.id }).eq("id", inv.id);

  revalidatePath("/configuracoes/usuarios");
  return ok(null, `Convite enviado para ${input.email}.`);
});

export const resendInvitation = defineAction({ schema: invitationIdSchema, permission: "users.manage" }, async ({ id }, { user }) => {
  if (!process.env.SUPABASE_SECRET_KEY) return fail("business_rule", SECRET_MISSING);
  if (!(await withinRateLimit(`invite:${user.id}`, 30, 3600))) return fail("business_rule", RATE_LIMIT_MESSAGE);

  const supabase = await createClient();
  const inv = must(await supabase.from("invitations").select("*").eq("id", id).is("portal_client_id", null).single()) as InvitationRow;
  if (inv.status !== "pendente") return fail("business_rule", "Só convites pendentes podem ser reenviados.");

  // Novo token e novo prazo; a conta pendente é recriada junto com o e-mail novo.
  await removePendingAccount(inv.user_id);
  const token = newToken();
  const admin = createAdminClient();
  const updated = must(
    await admin
      .from("invitations")
      .update({
        token_hash: hashToken(token),
        expires_at: expiresAt(),
        send_count: inv.send_count + 1,
        last_sent_at: new Date().toISOString(),
        user_id: null,
      })
      .eq("id", id)
      .select("*")
      .single(),
  ) as InvitationRow;

  const { data, error } = await sendInvite(updated, token, await inviteContext(updated.role_id!, user.fullName));
  if (error || !data.user) {
    console.error("[resendInvitation]", error?.code ?? error?.status);
    return fail("unknown", "Não foi possível reenviar o convite agora. Tente novamente.");
  }
  await admin.from("invitations").update({ user_id: data.user.id }).eq("id", id);
  revalidatePath("/configuracoes/usuarios");
  return ok(null, `Convite reenviado para ${updated.email}.`);
});

export const cancelInvitation = defineAction({ schema: invitationIdSchema, permission: "users.manage" }, async ({ id }, { user }) => {
  if (!process.env.SUPABASE_SECRET_KEY) return fail("business_rule", SECRET_MISSING);
  const supabase = await createClient();
  const inv = must(await supabase.from("invitations").select("*").eq("id", id).is("portal_client_id", null).single()) as InvitationRow;
  if (inv.status !== "pendente") return fail("business_rule", "Este convite não está mais pendente.");

  must(
    await createAdminClient()
      .from("invitations")
      .update({ status: "cancelado", cancelled_at: new Date().toISOString(), cancelled_by: user.id })
      .eq("id", id)
      .eq("status", "pendente"),
  );
  await removePendingAccount(inv.user_id);
  revalidatePath("/configuracoes/usuarios");
  return ok(null, "Convite revogado. O link deixou de funcionar.");
});

// --- Aceite (página pública /convite/[token]) ---------------------------------

export type InvitationPreview =
  | { state: "valido"; email: string; fullName: string; inviterName: string; roleName: string; expiresAt: string }
  | { state: "expirado" | "usado" | "cancelado" | "invalido" };

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export async function previewInvitation(token: string): Promise<InvitationPreview> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token) || !process.env.SUPABASE_SECRET_KEY) return { state: "invalido" };
  const { data } = await createAdminClient()
    .from("invitations")
    .select("email, full_name, status, expires_at, user_id, roles(name), clients(name), inviter:profiles!invitations_invited_by_fkey(full_name, email)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || !data.user_id) return { state: "invalido" };
  if (data.status === "aceito") return { state: "usado" };
  if (data.status === "cancelado") return { state: "cancelado" };
  if (new Date(data.expires_at).getTime() < Date.now()) return { state: "expirado" };
  const role = one(data.roles as { name: string } | { name: string }[] | null);
  const inviter = one(data.inviter as { full_name: string; email: string } | { full_name: string; email: string }[] | null);
  return {
    state: "valido",
    email: data.email,
    fullName: data.full_name,
    roleName: role?.name ?? (one(data.clients as { name: string } | { name: string }[] | null) ? `usuário da área do cliente de ${one(data.clients as { name: string } | { name: string }[] | null)!.name}` : ""),
    inviterName: inviter?.full_name || inviter?.email || "",
    expiresAt: data.expires_at,
  };
}

export async function acceptInvitation(raw: unknown): Promise<ActionResult<null>> {
  const parsed = acceptInvitationSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fieldErrors[i.path.join(".")] ??= []).push(i.message);
    return fail("validation", "Revise os campos destacados.", fieldErrors);
  }
  if (!process.env.SUPABASE_SECRET_KEY) return fail("business_rule", SECRET_MISSING);
  if (!(await withinRateLimit(`accept:${await clientIp()}`, 10, 900))) return fail("business_rule", RATE_LIMIT_MESSAGE);

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, email, status, expires_at, user_id, portal_client_id, clients(name), roles(name)")
    .eq("token_hash", hashToken(parsed.data.token))
    .maybeSingle();
  if (!inv || !inv.user_id || inv.status !== "pendente" || new Date(inv.expires_at).getTime() < Date.now()) {
    return fail("business_rule", "Este convite é inválido, já foi usado ou expirou. Peça um novo convite.");
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(inv.user_id, {
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (updErr) {
    if (updErr.code === "weak_password") return fail("validation", "Senha fraca. Use letras e números, com 8 ou mais caracteres.");
    console.error("[acceptInvitation]", updErr.code ?? updErr.status);
    return fail("unknown", "Não foi possível concluir o cadastro. Tente novamente.");
  }
  const { error: finErr } = await admin.rpc("finalize_invitation", { p_invitation: inv.id, p_full_name: parsed.data.fullName });
  if (finErr) return fail("business_rule", "Este convite é inválido, já foi usado ou expirou. Peça um novo convite.");

  // Registra a ciência da política e dos termos marcada no aceite.
  await admin.from("privacy_consents").upsert({ profile_id: inv.user_id, version: PRIVACY_VERSION }, { onConflict: "profile_id,version", ignoreDuplicates: true });

  // Boas-vindas com os primeiros passos. Falha no envio não impede a entrada.
  const person = { name: parsed.data.fullName, email: inv.email };
  const portalClient = one(inv.clients as { name: string } | { name: string }[] | null);
  const welcome = inv.portal_client_id
    ? portalWelcomeEmail(publicEnv.NEXT_PUBLIC_SITE_URL, person, portalClient?.name ?? "")
    : welcomeEmail(publicEnv.NEXT_PUBLIC_SITE_URL, { ...person, roleName: one(inv.roles as { name: string } | { name: string }[] | null)?.name });
  await sendEmail(inv.email, welcome.subject, welcome.parts);

  const supabase = await createClient();
  const { error: signErr } = await supabase.auth.signInWithPassword({ email: inv.email, password: parsed.data.password });
  if (signErr) redirect("/login");
  redirect(inv.portal_client_id ? "/portal" : "/inicio?bem-vindo=1");
}
