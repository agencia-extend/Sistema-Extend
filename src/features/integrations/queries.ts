import "server-only";
import { suggestClient, type OwnerKind, type Provider, type Purpose } from "@/domain/integrations";
import { createClient } from "@/lib/supabase/server";
import { env, missing, redirectUri } from "@/lib/integrations/config";

export type ConnectionView = {
  id: string;
  provider: Provider;
  purpose: Purpose;
  owner: OwnerKind;
  method: "oauth" | "system_user";
  accountName: string | null;
  accountEmail: string | null;
  status: string;
  lastError: string | null;
  expiresAt: string | null;
  accountsSyncedAt: string | null;
  connectedByName: string | null;
  createdAt: string;
  clientId: string | null;
  clientName: string | null;
};

/** Conexões da agência e da própria pessoa, sem tokens (RPC integration_status). */
export async function listConnections(): Promise<ConnectionView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("integration_status");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    provider: c.provider as Provider,
    purpose: c.purpose as Purpose,
    owner: c.owner_kind as OwnerKind,
    method: c.method as "oauth" | "system_user",
    accountName: c.account_name,
    accountEmail: c.account_email,
    status: c.status,
    lastError: c.last_error,
    expiresAt: c.expires_at,
    accountsSyncedAt: c.accounts_synced_at,
    connectedByName: c.connected_by_name,
    createdAt: c.created_at,
    clientId: c.client_id,
    clientName: c.client_name,
  }));
}

/** O que falta configurar e os endereços para cadastrar no app da Meta e no Google Cloud. */
export function integrationSetup() {
  return {
    meta: { missing: missing("meta"), hasLoginConfig: Boolean(env("META_LOGIN_CONFIG_ID")), redirectUri: redirectUri("meta") },
    google: { missing: missing("google"), redirectUri: redirectUri("google") },
  };
}

export type AdAccountView = {
  id: string;
  provider: Provider;
  externalId: string;
  name: string;
  currency: string | null;
  statusLabel: string | null;
  managerName: string | null;
  viaPersonal: boolean;
  viaClient: boolean;
  clientId: string | null;
  suggestedClientId: string | null;
  isEnabled: boolean;
  lastSeenAt: string;
};

export async function listAdAccounts(): Promise<AdAccountView[]> {
  const supabase = await createClient();
  const [{ data, error }, { data: links }] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select("id, provider, external_id, name, currency, status_label, client_id, is_enabled, last_seen_at, ad_managers(name), connection_id")
      .order("is_enabled", { ascending: false })
      .order("name"),
    supabase.from("client_accounts").select("client_id, kind, value").in("kind", ["ad_account_meta", "ad_account_google"]),
  ]);
  if (error) throw error;
  const known = (links ?? []).map((l) => ({ clientId: l.client_id, kind: l.kind, value: l.value }));
  const conns = await listConnections();
  const personal = new Set(conns.filter((c) => c.owner === "user").map((c) => c.id));
  const fromClient = new Set(conns.filter((c) => c.owner === "client").map((c) => c.id));
  return (data ?? []).map((a) => {
    const m = Array.isArray(a.ad_managers) ? a.ad_managers[0] : a.ad_managers;
    return {
      id: a.id,
      provider: a.provider as Provider,
      externalId: a.external_id,
      name: a.name,
      currency: a.currency,
      statusLabel: a.status_label,
      managerName: (m as { name: string } | null)?.name ?? null,
      viaPersonal: Boolean(a.connection_id && personal.has(a.connection_id)),
      viaClient: Boolean(a.connection_id && fromClient.has(a.connection_id)),
      clientId: a.client_id,
      suggestedClientId: a.client_id ? null : suggestClient({ provider: a.provider as Provider, externalId: a.external_id }, known),
      isEnabled: a.is_enabled,
      lastSeenAt: a.last_seen_at,
    };
  });
}

/** Clientes que podem receber uma conta (ativos, em onboarding ou pausados). */
export async function listLinkableClients(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name").is("deleted_at", null).in("status", ["ativo", "onboarding", "pausado"]).order("name");
  if (error) throw error;
  return data ?? [];
}

export type ClientFacebook = {
  configured: boolean;
  appLive: boolean;
  connection: ConnectionView | null;
  link: { id: string; expiresAt: string; createdAt: string } | null;
  accounts: { id: string; name: string; externalId: string; statusLabel: string | null; isEnabled: boolean; viaThis: boolean }[];
};

/** Facebook do cliente na aba Tráfego: a conexão, o link aberto e as contas de anúncio do cliente. */
export async function getClientFacebook(clientId: string): Promise<ClientFacebook> {
  const supabase = await createClient();
  const [conns, { data: links }, { data: accounts }] = await Promise.all([
    listConnections(),
    supabase.from("client_connect_links").select("id, expires_at, created_at").eq("client_id", clientId).is("revoked_at", null).is("used_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1),
    supabase.from("ad_accounts").select("id, name, external_id, status_label, is_enabled, connection_id").eq("client_id", clientId).eq("provider", "meta").order("name"),
  ]);
  const connection = conns.find((c) => c.owner === "client" && c.clientId === clientId) ?? null;
  const l = links?.[0];
  return {
    configured: missing("meta").length === 0,
    appLive: env("META_APP_LIVE") === "1",
    connection,
    link: l ? { id: l.id, expiresAt: l.expires_at, createdAt: l.created_at } : null,
    accounts: (accounts ?? []).map((a) => ({ id: a.id, name: a.name, externalId: a.external_id, statusLabel: a.status_label, isEnabled: a.is_enabled, viaThis: Boolean(connection && a.connection_id === connection.id) })),
  };
}
