import "server-only";
import { googleAccountStatus, googleCustomerId, googleErrorMessage, type Purpose } from "@/domain/integrations";
import { env, redirectUri } from "./config";

// Google OAuth + Google Ads API (REST, somente leitura) + Google Agenda.
// O acesso à Google Ads API vem do projeto do Google Cloud (o developer token foi aposentado em 09/2026).
export const GOOGLE_SCOPES: Record<Purpose, string[]> = {
  ads: ["openid", "email", "https://www.googleapis.com/auth/adwords"],
  calendar: ["openid", "email", "https://www.googleapis.com/auth/calendar.events"],
};
const adsApi = () => `https://googleads.googleapis.com/${env("GOOGLE_ADS_API_VERSION") || "v26"}`;

export class GoogleError extends Error {
  reason?: string;
  status?: number;
  expired: boolean;
  constructor(reason?: string, status?: number) {
    const m = googleErrorMessage(reason, status);
    super(m.message);
    this.reason = reason;
    this.status = status;
    this.expired = m.expired;
  }
}

export function googleAuthUrl(state: string, purpose: Purpose) {
  const q = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri("google"),
    response_type: "code",
    scope: GOOGLE_SCOPES[purpose].join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; id_token?: string; scope?: string; error?: string };

async function token(body: Record<string, string>): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), ...body }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw Object.assign(new GoogleError(), { message: "Sem resposta do Google (rede). Tente de novo em instantes." });
  }
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) throw new GoogleError(json.error, res.status === 401 ? undefined : res.status);
  return json;
}

export async function googleExchangeCode(code: string) {
  const t = await token({ code, grant_type: "authorization_code", redirect_uri: redirectUri("google") });
  const payload = t.id_token ? (JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString("utf8")) as { email?: string; sub?: string }) : {};
  return { ...t, email: payload.email ?? "", sub: payload.sub ?? "", scopes: (t.scope ?? "").split(" ").filter(Boolean) };
}

export const googleRefresh = (refreshToken: string) => token({ grant_type: "refresh_token", refresh_token: refreshToken });

export async function googleRevoke(tokenValue: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenValue)}`, { method: "POST", cache: "no-store" }).catch(() => null);
}

async function adsRequest<T>(accessToken: string, path: string, init: RequestInit | undefined, login: string | null): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    if (login) headers["login-customer-id"] = login;
    let res: Response;
    try {
      res = await fetch(`${adsApi()}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    } catch {
      throw Object.assign(new GoogleError(), { message: "Sem resposta do Google Ads (rede). Tente de novo em instantes." });
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
      continue;
    }
    const data = (await res.json().catch(() => ({}))) as T & { error?: { status?: string; details?: { errors?: { errorCode?: Record<string, string> }[] }[] } };
    if (!res.ok) {
      const code = data.error?.details?.[0]?.errors?.[0]?.errorCode;
      throw new GoogleError(code ? Object.values(code)[0] : data.error?.status, res.status);
    }
    return data;
  }
}

async function search<T>(accessToken: string, customerId: string, query: string, login: string | null): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  for (let guard = 0; guard < 50; guard++) {
    const d = await adsRequest<{ results?: T[]; nextPageToken?: string }>(accessToken, `/customers/${customerId}/googleAds:search`, {
      method: "POST",
      body: JSON.stringify({ query, ...(pageToken ? { pageToken } : {}) }),
    }, login);
    out.push(...(d.results ?? []));
    pageToken = d.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export type GoogleManager = { id: string; name: string };
export type GoogleAdAccount = { externalId: string; name: string; currency: string | null; status: string | null; managerId: string | null; loginCustomerId: string | null };

type CustomerRow = { customer?: { id?: string; descriptiveName?: string; currencyCode?: string; status?: string; manager?: boolean } };
type ClientRow = { customerClient?: { id?: string; descriptiveName?: string; currencyCode?: string; status?: string; manager?: boolean } };

/**
 * MCCs e contas que a conta Google conectada enxerga: as acessíveis direto e, dentro de cada MCC, as contas
 * em qualquer nível. Cada conta guarda a MCC pela qual responde (login-customer-id).
 */
export async function googleDiscover(accessToken: string): Promise<{ managers: GoogleManager[]; accounts: GoogleAdAccount[] }> {
  const { resourceNames = [] } = await adsRequest<{ resourceNames?: string[] }>(accessToken, "/customers:listAccessibleCustomers", { method: "GET" }, null);
  const ids = resourceNames.map((r) => r.split("/")[1]);
  const managers: GoogleManager[] = [];
  const accounts = new Map<string, GoogleAdAccount>();
  for (const id of ids) {
    const [row] = await search<CustomerRow>(accessToken, id, "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.status, customer.manager FROM customer LIMIT 1", null).catch(
      // Conta acessível mas desativada ou sem permissão de leitura: pula.
      (e: GoogleError) => (e.expired ? Promise.reject(e) : ([] as CustomerRow[])),
    );
    const c = row?.customer;
    if (!c) continue;
    if (c.manager) {
      managers.push({ id, name: c.descriptiveName || `MCC ${googleCustomerId(id)}` });
      const children = await search<ClientRow>(
        accessToken,
        id,
        "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.status, customer_client.manager FROM customer_client WHERE customer_client.level >= 1",
        id,
      );
      for (const ch of children) {
        const cc = ch.customerClient;
        if (!cc?.id || cc.manager) continue;
        accounts.set(String(cc.id), {
          externalId: String(cc.id),
          name: cc.descriptiveName || `Conta ${googleCustomerId(String(cc.id))}`,
          currency: cc.currencyCode ?? null,
          status: googleAccountStatus(cc.status),
          managerId: id,
          loginCustomerId: id,
        });
      }
    } else if (!accounts.has(id)) {
      accounts.set(id, { externalId: id, name: c.descriptiveName || `Conta ${googleCustomerId(id)}`, currency: c.currencyCode ?? null, status: googleAccountStatus(c.status), managerId: null, loginCustomerId: null });
    }
  }
  return { managers, accounts: [...accounts.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) };
}

/** Agenda principal da pessoa conectada (para mostrar qual agenda recebe os eventos). */
export async function googlePrimaryCalendar(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res) throw Object.assign(new GoogleError(), { message: "Sem resposta do Google Agenda (rede). Tente de novo em instantes." });
  const data = (await res.json().catch(() => ({}))) as { id?: string; summary?: string; error?: { status?: string } };
  if (!res.ok) throw new GoogleError(data.error?.status, res.status);
  return { id: data.id ?? "primary", name: data.summary ?? data.id ?? "Agenda principal" };
}
