import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { OwnerKind, Provider, Purpose } from "@/domain/integrations";
import type { PermissionKey } from "@/domain/permissions";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/dal";
import { configured } from "./config";

const COOKIE = "ext_oauth";
const PATH = "/api/integracoes";

/** Para quem é a conexão: define a permissão exigida e para onde voltar. */
export type Target = { provider: Provider; owner: OwnerKind; purpose: Purpose };

export const TARGETS: Record<string, Target> = {
  "meta:agencia": { provider: "meta", owner: "agency", purpose: "ads" },
  "meta:pessoal": { provider: "meta", owner: "user", purpose: "ads" },
  "google:agencia": { provider: "google", owner: "agency", purpose: "ads" },
  "google:agenda": { provider: "google", owner: "user", purpose: "calendar" },
};

export function permissionFor(t: Target): PermissionKey {
  if (t.owner === "agency") return "ads.connect";
  return t.purpose === "calendar" ? "calendar.read" : "ads.manage";
}

export const backTo = (t: Target) => (t.owner === "agency" ? "/configuracoes/integracoes" : "/configuracoes/perfil");

const withQuery = (path: string, q: string) => `${path}${path.includes("?") ? "&" : "?"}${q}`;

/** Início: confere sessão, permissão e configuração; grava o state + destino num cookie de 10 minutos. */
export async function startOAuth(request: NextRequest, key: string, authUrl: (state: string, t: Target) => string) {
  const t = TARGETS[key];
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!t) return NextResponse.redirect(new URL("/configuracoes/integracoes?erro=destino", request.url));
  if (!user.permissions[permissionFor(t)]) return NextResponse.redirect(new URL(`/sem-acesso?p=${permissionFor(t)}`, request.url));
  if (!configured(t.provider)) return NextResponse.redirect(new URL(withQuery(backTo(t), "erro=configuracao"), request.url));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authUrl(state, t));
  res.cookies.set(COOKIE, `${state}.${key}`, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: PATH, maxAge: 600 });
  return res;
}

type Checked = { ok: true; user: CurrentUser; code: string; target: Target; back: (q: string) => NextResponse } | { ok: false; response: NextResponse };

/** Retorno: confere sessão, state (tempo constante), destino e permissão. */
export async function checkCallback(request: NextRequest, provider: Provider): Promise<Checked> {
  const raw = request.cookies.get(COOKIE)?.value ?? "";
  const dot = raw.indexOf(".");
  const expected = dot > 0 ? raw.slice(0, dot) : "";
  const target = TARGETS[raw.slice(dot + 1)];
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(withQuery(target ? backTo(target) : "/configuracoes/integracoes", q), request.url));
    res.cookies.delete({ name: COOKIE, path: PATH });
    return res;
  };
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: NextResponse.redirect(new URL("/login", request.url)) };
  if (!target || target.provider !== provider) return { ok: false, response: back("erro=estado") };
  if (!user.permissions[permissionFor(target)]) return { ok: false, response: back("erro=permissao") };
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return { ok: false, response: back("erro=cancelado") };
  const state = params.get("state") ?? "";
  if (!state || !expected || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected)))
    return { ok: false, response: back("erro=estado") };
  const code = params.get("code") ?? "";
  if (!code) return { ok: false, response: back("erro=cancelado") };
  return { ok: true, user, code, target, back };
}
