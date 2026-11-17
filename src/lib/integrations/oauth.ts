import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { OwnerKind, Provider, Purpose } from "@/domain/integrations";
import type { PermissionKey } from "@/domain/permissions";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { configured } from "./config";

const COOKIE = "ext_oauth";
const PATH = "/api/integracoes";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LINK_TOKEN = /^[A-Za-z0-9_-]{40,60}$/;

/** Para quem é a conexão: define a permissão exigida e para onde voltar. */
export type Target = { provider: Provider; owner: OwnerKind; purpose: Purpose; clientId?: string };

export const TARGETS: Record<string, Target> = {
  "meta:agencia": { provider: "meta", owner: "agency", purpose: "ads" },
  "meta:pessoal": { provider: "meta", owner: "user", purpose: "ads" },
  "meta:cliente": { provider: "meta", owner: "client", purpose: "ads" },
  "google:agencia": { provider: "google", owner: "agency", purpose: "ads" },
  "google:agenda": { provider: "google", owner: "user", purpose: "calendar" },
};

/** "meta:cliente:<id do cliente>" vira o destino com o cliente; os outros são fixos. */
export function parseTarget(key: string): Target | null {
  const [provider, kind, extra] = key.split(":");
  const base = TARGETS[`${provider}:${kind}`];
  if (!base) return null;
  if (base.owner !== "client") return extra === undefined ? base : null;
  return extra && UUID.test(extra) ? { ...base, clientId: extra.toLowerCase() } : null;
}

export function permissionFor(t: Target): PermissionKey {
  if (t.owner === "agency") return "ads.connect";
  return t.purpose === "calendar" ? "calendar.read" : "ads.manage";
}

export const backTo = (t: Target) =>
  t.owner === "agency" ? "/configuracoes/integracoes" : t.owner === "client" ? `/clientes/${t.clientId}/trafego#facebook` : "/configuracoes/perfil";

const withQuery = (path: string, q: string) => {
  const [base, hash] = path.split("#");
  return `${base}${base.includes("?") ? "&" : "?"}${q}${hash ? `#${hash}` : ""}`;
};

/** Facebook do cliente: além da permissão, a pessoa precisa cuidar do tráfego desse cliente (conferido no banco). */
async function allowed(user: CurrentUser, t: Target) {
  if (!user.permissions[permissionFor(t)]) return false;
  if (t.owner !== "client") return true;
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_client_ads", { p_client: t.clientId! });
  return data === true;
}

function setCookie(res: NextResponse, request: NextRequest, value: string) {
  res.cookies.set(COOKIE, value, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: PATH, maxAge: 600 });
  return res;
}

/** Início: confere sessão, permissão e configuração; grava o state + destino num cookie de 10 minutos. */
export async function startOAuth(request: NextRequest, key: string, authUrl: (state: string, t: Target) => string) {
  const t = parseTarget(key);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!t) return NextResponse.redirect(new URL("/configuracoes/integracoes?erro=destino", request.url));
  if (!(await allowed(user, t))) return NextResponse.redirect(new URL(`/sem-acesso?p=${permissionFor(t)}`, request.url));
  if (!configured(t.provider)) return NextResponse.redirect(new URL(withQuery(backTo(t), "erro=configuracao"), request.url));
  const state = randomBytes(24).toString("base64url");
  return setCookie(NextResponse.redirect(authUrl(state, t)), request, `${state}.${key}`);
}

/** Início pelo link do cliente (sem sessão): o código do link vai no cookie junto com o state. */
export function startLinkOAuth(request: NextRequest, linkToken: string, authUrl: (state: string) => string) {
  const state = randomBytes(24).toString("base64url");
  return setCookie(NextResponse.redirect(authUrl(state)), request, `${state}.meta:link:${linkToken}`);
}

type Ok = { code: string; back: (q: string) => NextResponse };
type Checked =
  | ({ ok: true; via: "session"; user: CurrentUser; target: Target } & Ok)
  | ({ ok: true; via: "link"; linkToken: string } & Ok)
  | { ok: false; response: NextResponse };

const sameState = (got: string, expected: string) =>
  Boolean(got && expected && got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected)));

/** Retorno: confere state (tempo constante), destino e, quando há sessão, a permissão. */
export async function checkCallback(request: NextRequest, provider: Provider): Promise<Checked> {
  const raw = request.cookies.get(COOKIE)?.value ?? "";
  const dot = raw.indexOf(".");
  const expected = dot > 0 ? raw.slice(0, dot) : "";
  const key = raw.slice(dot + 1);
  const params = request.nextUrl.searchParams;
  const state = params.get("state") ?? "";
  const code = params.get("code") ?? "";

  // Link do cliente: volta para a página pública do link, sem pedir login no sistema.
  if (provider === "meta" && key.startsWith("meta:link:")) {
    const linkToken = key.slice("meta:link:".length);
    const back = (q: string) => {
      const res = NextResponse.redirect(new URL(`/conectar/${LINK_TOKEN.test(linkToken) ? linkToken : ""}?${q}`, request.url));
      res.cookies.delete({ name: COOKIE, path: PATH });
      return res;
    };
    if (!LINK_TOKEN.test(linkToken)) return { ok: false, response: back("erro=estado") };
    if (params.get("error")) return { ok: false, response: back("erro=cancelado") };
    if (!sameState(state, expected)) return { ok: false, response: back("erro=estado") };
    if (!code) return { ok: false, response: back("erro=cancelado") };
    return { ok: true, via: "link", linkToken, code, back };
  }

  const target = parseTarget(key);
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(withQuery(target ? backTo(target) : "/configuracoes/integracoes", q), request.url));
    res.cookies.delete({ name: COOKIE, path: PATH });
    return res;
  };
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: NextResponse.redirect(new URL("/login", request.url)) };
  if (!target || target.provider !== provider) return { ok: false, response: back("erro=estado") };
  if (!(await allowed(user, target))) return { ok: false, response: back("erro=permissao") };
  if (params.get("error")) return { ok: false, response: back("erro=cancelado") };
  if (!sameState(state, expected)) return { ok: false, response: back("erro=estado") };
  if (!code) return { ok: false, response: back("erro=cancelado") };
  return { ok: true, via: "session", user, code, target, back };
}
