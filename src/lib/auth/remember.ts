import "server-only";
import { cookies } from "next/headers";

/**
 * "Manter conectado": sem a opção, a sessão termina quando o navegador fecha.
 * ext_lembrar=0 (persistente) diz que a pessoa não quis ficar conectada;
 * ext_sessao (cookie de sessão) existe enquanto o navegador está aberto.
 * O proxy encerra a sessão quando o primeiro existe e o segundo sumiu.
 */
export const REMEMBER_COOKIE = "ext_lembrar";
export const SESSION_COOKIE = "ext_sessao";

const base = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export async function applyRememberChoice(remember: boolean) {
  const jar = await cookies();
  if (remember) {
    jar.delete(REMEMBER_COOKIE);
    jar.delete(SESSION_COOKIE);
    return;
  }
  jar.set(REMEMBER_COOKIE, "0", { ...base, maxAge: 400 * 24 * 3600 });
  jar.set(SESSION_COOKIE, "1", base);
}

export async function clearRememberChoice() {
  const jar = await cookies();
  jar.delete(REMEMBER_COOKIE);
  jar.delete(SESSION_COOKIE);
}
