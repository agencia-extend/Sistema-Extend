import "server-only";
import { metaAccountId, metaAccountStatus, metaErrorMessage } from "@/domain/integrations";
import { env, redirectUri } from "./config";

// Graph API oficial da Meta (somente leitura nesta etapa).
// Sem configuração do "Login do Facebook para Empresas" (META_LOGIN_CONFIG_ID), pede estas permissões.
export const META_SCOPES = ["ads_read", "business_management", "pages_show_list", "pages_read_engagement"];
const version = () => env("META_GRAPH_VERSION") || "v23.0";
const graph = (path: string) => `https://graph.facebook.com/${version()}${path}`;

export class MetaError extends Error {
  code?: number;
  expired: boolean;
  constructor(code?: number, subcode?: number) {
    const m = metaErrorMessage(code, subcode);
    super(m.message);
    this.code = code;
    this.expired = m.expired;
  }
}

export function metaAuthUrl(state: string) {
  const q = new URLSearchParams({ client_id: env("META_APP_ID"), redirect_uri: redirectUri("meta"), state, response_type: "code" });
  // App do tipo Empresa: as permissões e os ativos vêm da configuração do login (config_id).
  const configId = env("META_LOGIN_CONFIG_ID");
  if (configId) q.set("config_id", configId);
  else q.set("scope", META_SCOPES.join(","));
  return `https://www.facebook.com/${version()}/dialog/oauth?${q}`;
}

type GraphError = { error?: { message: string; code: number; error_subcode?: number } };

async function get<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    } catch {
      throw Object.assign(new MetaError(), { message: "Sem resposta da Meta (rede). Tente de novo em instantes." });
    }
    const data = (await res.json().catch(() => ({}))) as T & GraphError;
    if (data.error && [4, 17, 32, 613].includes(data.error.code) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
      continue;
    }
    if (!res.ok || data.error) throw new MetaError(data.error?.code, data.error?.error_subcode);
    return data;
  }
}

type Paged<T> = { data: T[]; paging?: { next?: string } };
async function all<T>(url: string, max = 5000): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = url;
  while (next && out.length < max) {
    const page: Paged<T> = await get<Paged<T>>(next);
    out.push(...page.data);
    next = page.paging?.next;
  }
  return out;
}

const tk = (token: string) => `access_token=${encodeURIComponent(token)}`;

/** Código do login → token de longa duração (~60 dias) e quem conectou. */
export async function metaExchangeCode(code: string) {
  const base = { client_id: env("META_APP_ID"), client_secret: env("META_APP_SECRET") };
  const short = await get<{ access_token: string }>(graph(`/oauth/access_token?${new URLSearchParams({ ...base, redirect_uri: redirectUri("meta"), code })}`));
  const long = await get<{ access_token: string; expires_in?: number }>(
    graph(`/oauth/access_token?${new URLSearchParams({ ...base, grant_type: "fb_exchange_token", fb_exchange_token: short.access_token })}`),
  );
  const who = await metaWhoAmI(long.access_token);
  return { token: long.access_token, expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null, ...who };
}

/** Quem é o dono do token e quando vence (token de usuário do sistema do BM costuma não vencer). */
export async function metaWhoAmI(token: string) {
  const me = await get<{ id: string; name?: string }>(graph(`/me?fields=id,name&${tk(token)}`));
  const appToken = `${env("META_APP_ID")}|${env("META_APP_SECRET")}`;
  const dbg = await get<{ data?: { expires_at?: number; scopes?: string[]; is_valid?: boolean; app_id?: string } }>(
    graph(`/debug_token?input_token=${encodeURIComponent(token)}&${tk(appToken)}`),
  );
  if (dbg.data?.is_valid === false) throw new MetaError(190);
  if (dbg.data?.app_id && dbg.data.app_id !== env("META_APP_ID"))
    throw Object.assign(new MetaError(), { message: "Este token foi gerado para outro app da Meta. Gere o token no app da Extend." });
  const exp = dbg.data?.expires_at;
  return { externalUserId: me.id, name: me.name ?? me.id, scopes: dbg.data?.scopes ?? [], tokenExpiresAt: exp ? new Date(exp * 1000).toISOString() : null };
}

export async function metaRevoke(token: string) {
  await fetch(graph(`/me/permissions?${tk(token)}`), { method: "DELETE", cache: "no-store" }).catch(() => null);
}

export type MetaBusiness = { id: string; name: string };
export type MetaAdAccount = { externalId: string; name: string; currency: string | null; status: string | null; businessId: string | null; businessName: string | null };

type AccountRow = { id: string; name: string; currency?: string; account_status?: number; business?: { id: string; name: string } };
const ACCOUNT_FIELDS = "id,name,currency,account_status,business{id,name}";
const toAccount = (a: AccountRow, bm?: MetaBusiness): MetaAdAccount => ({
  externalId: metaAccountId(a.id),
  name: a.name,
  currency: a.currency ?? null,
  status: metaAccountStatus(a.account_status),
  businessId: a.business?.id ?? bm?.id ?? null,
  businessName: a.business?.name ?? bm?.name ?? null,
});

/**
 * BMs e contas de anúncio que o token enxerga: as do próprio usuário/usuário do sistema, as que cada BM
 * possui e as de clientes compartilhadas com o BM (parceiro). Sem repetir conta.
 */
export async function metaDiscover(token: string): Promise<{ businesses: MetaBusiness[]; accounts: MetaAdAccount[] }> {
  const businesses = (await all<{ id: string; name: string }>(graph(`/me/businesses?fields=id,name&limit=100&${tk(token)}`))).map((b) => ({ id: b.id, name: b.name }));
  const found = new Map<string, MetaAdAccount>();
  for (const a of await all<AccountRow>(graph(`/me/adaccounts?fields=${ACCOUNT_FIELDS}&limit=100&${tk(token)}`))) found.set(metaAccountId(a.id), toAccount(a));
  for (const bm of businesses) {
    for (const edge of ["owned_ad_accounts", "client_ad_accounts"]) {
      const rows = await all<AccountRow>(graph(`/${bm.id}/${edge}?fields=${ACCOUNT_FIELDS}&limit=100&${tk(token)}`)).catch((e: MetaError) => {
        // Sem permissão de ver as contas de um BM específico: segue com os outros.
        if (e.code === 10 || e.code === 200 || e.code === 100) return [] as AccountRow[];
        throw e;
      });
      for (const a of rows) if (!found.has(metaAccountId(a.id))) found.set(metaAccountId(a.id), toAccount(a, bm));
    }
  }
  return { businesses, accounts: [...found.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) };
}
