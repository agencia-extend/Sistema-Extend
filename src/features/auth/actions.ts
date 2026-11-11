"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { applyRememberChoice, clearRememberChoice } from "@/lib/auth/remember";
import { clientIp, isRateLimited, RATE_LIMIT_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { fail, ok, type ActionResult } from "@/domain/shared/result";
import { loginSchema, newPasswordSchema, resetRequestSchema } from "./schemas";

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string[]> = {};
  for (const i of issues) (out[i.path.join(".") || "_"] ??= []).push(i.message);
  return out;
}

/** Só redireciona para caminhos internos (evita open redirect). */
function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/inicio";
}

export async function login(raw: unknown): Promise<ActionResult<null>> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", "Revise os campos destacados.", fieldErrors(parsed.error.issues));
  const { email, password, remember, next } = parsed.data;

  // Bloqueio temporário: 5 tentativas ERRADAS por e-mail e 20 por IP a cada 15 minutos.
  const ip = await clientIp();
  const LOCKED = "Muitas tentativas de login. Por segurança, aguarde 15 minutos e tente de novo.";
  const [emailLocked, ipLocked] = await Promise.all([isRateLimited(`login:${email}`, 5, 900), isRateLimited(`login-ip:${ip}`, 20, 900)]);
  if (emailLocked || ipLocked) return fail("business_rule", LOCKED);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("fetch failed")) {
      return fail("network", "Sem conexão com o servidor. Verifique sua internet e tente novamente.");
    }
    await Promise.all([withinRateLimit(`login:${email}`, 5, 900), withinRateLimit(`login-ip:${ip}`, 20, 900)]);
    return fail("validation", "E-mail ou senha incorretos.");
  }

  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    return fail("forbidden", "Este acesso está desativado. Fale com o administrador da Extend.");
  }

  try {
    await createAdminClient().rpc("rate_limit_reset", { p_bucket: `login:${email}` });
  } catch {
    // Sem a chave secreta o limite apenas expira sozinho.
  }
  await applyRememberChoice(remember);
  redirect(safeNext(next));
}

export async function requestPasswordReset(raw: unknown): Promise<ActionResult<null>> {
  const parsed = resetRequestSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", "Informe um e-mail válido.", fieldErrors(parsed.error.issues));
  if (!(await withinRateLimit(`reset:${await clientIp()}`, 5, 3600))) return fail("business_rule", RATE_LIMIT_MESSAGE);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/definir-senha`,
  });
  if (error?.status === 429) return fail("business_rule", RATE_LIMIT_MESSAGE);
  // Mesma resposta exista ou não a conta (não revela quem tem acesso).
  return ok(null, "Se este e-mail tiver acesso ao sistema, você vai receber um link para criar uma nova senha.");
}

export async function setNewPassword(raw: unknown): Promise<ActionResult<null>> {
  const parsed = newPasswordSchema.safeParse(raw);
  if (!parsed.success) return fail("validation", "Revise os campos destacados.", fieldErrors(parsed.error.issues));
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return fail("unauthenticated", "O link expirou. Peça um novo em “Esqueci minha senha”.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail("validation", "A nova senha precisa ser diferente da atual.");
    if (error.code === "weak_password") return fail("validation", "Senha fraca. Use letras e números, com 8 ou mais caracteres.");
    return fail("unknown", "Não foi possível salvar a senha. Tente novamente.");
  }
  redirect("/inicio?senha=ok");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  await clearRememberChoice();
  redirect("/login");
}
