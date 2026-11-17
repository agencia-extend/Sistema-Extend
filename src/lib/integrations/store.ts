import "server-only";
import type { OwnerKind, Provider, Purpose } from "@/domain/integrations";
import { decrypt, encrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleError, googleDiscover, googleRefresh } from "./google";
import { MetaError, metaDiscover } from "./meta";

// Só o servidor lê e grava integration_connections (a tabela não tem grant para usuários).

export type StoredConnection = {
  id: string;
  organization_id: string;
  provider: Provider;
  purpose: Purpose;
  owner_kind: OwnerKind;
  profile_id: string | null;
  client_id: string | null;
  token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string | null;
  status: string;
  resource_id: string | null;
};

type SaveInput = {
  organizationId: string;
  provider: Provider;
  purpose: Purpose;
  owner: OwnerKind;
  profileId: string | null;
  /** Facebook do cliente: o cliente dono da conexão. */
  clientId?: string | null;
  method: "oauth" | "system_user";
  accountName: string;
  accountEmail?: string | null;
  externalUserId?: string | null;
  scopes: string[];
  token: string;
  refreshToken?: string | null;
  expiresAt: string | null;
  connectedBy: string | null;
  /** Google Agenda: id da agenda "Sistema Extend" criada na conta da pessoa. */
  resourceId?: string | null;
};

/** Grava (ou troca) a conexão. Reconectar substitui o token e limpa o erro. */
export async function saveConnection(i: SaveInput): Promise<string> {
  const db = createAdminClient();
  let q = db.from("integration_connections").select("id, refresh_token_enc").eq("provider", i.provider).eq("purpose", i.purpose).eq("owner_kind", i.owner);
  q = i.owner === "agency" ? q.eq("organization_id", i.organizationId) : i.owner === "client" ? q.eq("client_id", i.clientId!) : q.eq("profile_id", i.profileId!);
  const { data: existing } = await q.maybeSingle();
  const row = {
    organization_id: i.organizationId,
    provider: i.provider,
    purpose: i.purpose,
    owner_kind: i.owner,
    profile_id: i.profileId,
    client_id: i.owner === "client" ? (i.clientId ?? null) : null,
    method: i.method,
    account_name: i.accountName,
    account_email: i.accountEmail ?? null,
    external_user_id: i.externalUserId ?? null,
    scopes: i.scopes,
    token_enc: encrypt(i.token),
    // O Google só manda o refresh token no primeiro consentimento: mantém o anterior se não vier outro.
    refresh_token_enc: i.refreshToken ? encrypt(i.refreshToken) : (existing?.refresh_token_enc ?? null),
    expires_at: i.expiresAt,
    status: "active",
    last_error: null,
    last_checked_at: new Date().toISOString(),
    connected_by: i.connectedBy,
    ...(i.resourceId !== undefined ? { resource_id: i.resourceId } : {}),
  };
  if (existing) {
    const { error } = await db.from("integration_connections").update(row).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await db.from("integration_connections").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function getConnection(id: string): Promise<StoredConnection | null> {
  const { data } = await createAdminClient().from("integration_connections").select("*").eq("id", id).maybeSingle();
  return (data as StoredConnection | null) ?? null;
}

export async function markConnection(id: string, status: "active" | "expired" | "error", lastError: string | null) {
  await createAdminClient().from("integration_connections").update({ status, last_error: lastError, last_checked_at: new Date().toISOString() }).eq("id", id);
}

/** Token pronto para chamar a API. Google renova pelo refresh token; Meta não renova sozinha. */
export async function accessToken(conn: StoredConnection): Promise<string> {
  if (conn.provider === "google") {
    if (conn.expires_at && new Date(conn.expires_at).getTime() > Date.now() + 60_000) return decrypt(conn.token_enc);
    if (!conn.refresh_token_enc) throw new GoogleError("invalid_grant");
    const t = await googleRefresh(decrypt(conn.refresh_token_enc));
    await createAdminClient()
      .from("integration_connections")
      .update({ token_enc: encrypt(t.access_token), expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString() })
      .eq("id", conn.id);
    return t.access_token;
  }
  if (conn.expires_at && new Date(conn.expires_at).getTime() < Date.now()) throw new MetaError(190);
  return decrypt(conn.token_enc);
}

/** Erro da API: grava na conexão (expirada ou com erro) e devolve a mensagem para a tela. */
export async function recordFailure(conn: StoredConnection, e: unknown): Promise<string> {
  const known = e instanceof MetaError || e instanceof GoogleError;
  const message = known ? e.message : "Não foi possível falar com a plataforma agora. Tente de novo em instantes.";
  await markConnection(conn.id, known && e.expired ? "expired" : "error", message);
  return message;
}

/**
 * Busca BMs/MCCs e contas de anúncio da conexão e grava. Contas novas entram desligadas e sem cliente
 * (alguém escolhe quais entram); as já existentes só atualizam nome, moeda, situação e MCC.
 */
export async function discoverAccounts(conn: StoredConnection): Promise<{ managers: number; accounts: number }> {
  const db = createAdminClient();
  const token = await accessToken(conn);
  const now = new Date().toISOString();
  const found =
    conn.provider === "meta"
      ? await metaDiscover(token).then((d) => ({
          managers: d.businesses.map((b) => ({ external_id: b.id, name: b.name })),
          accounts: d.accounts.map((a) => ({ external_id: a.externalId, name: a.name, currency: a.currency, status_label: a.status, manager: a.businessId, login_customer_id: null as string | null })),
        }))
      : await googleDiscover(token).then((d) => ({
          managers: d.managers.map((m) => ({ external_id: m.id, name: m.name })),
          accounts: d.accounts.map((a) => ({ external_id: a.externalId, name: a.name, currency: a.currency, status_label: a.status, manager: a.managerId, login_customer_id: a.loginCustomerId })),
        }));

  const managerIds = new Map<string, string>();
  if (found.managers.length) {
    const { data, error } = await db
      .from("ad_managers")
      .upsert(found.managers.map((m) => ({ ...m, organization_id: conn.organization_id, provider: conn.provider, connection_id: conn.id, last_seen_at: now })), { onConflict: "organization_id,provider,external_id" })
      .select("id, external_id");
    if (error) throw error;
    for (const m of data ?? []) managerIds.set(m.external_id, m.id);
  }
  // Conta que já responde pela conexão da agência continua com ela (a conexão pessoal ou do cliente só traz as que faltam).
  let accounts = found.accounts;
  if (conn.owner_kind !== "agency" && accounts.length) {
    const { data: agency } = await db
      .from("ad_accounts")
      .select("external_id, integration_connections!inner(owner_kind)")
      .eq("organization_id", conn.organization_id)
      .eq("provider", conn.provider)
      .eq("integration_connections.owner_kind", "agency")
      .in("external_id", accounts.map((a) => a.external_id));
    const taken = new Set((agency ?? []).map((r) => r.external_id));
    accounts = accounts.filter((a) => !taken.has(a.external_id));
  }
  if (accounts.length) {
    const { error } = await db.from("ad_accounts").upsert(
      accounts.map((a) => ({
        organization_id: conn.organization_id,
        provider: conn.provider,
        external_id: a.external_id,
        name: a.name,
        currency: a.currency,
        status_label: a.status_label,
        manager_id: a.manager ? (managerIds.get(a.manager) ?? null) : null,
        login_customer_id: a.login_customer_id,
        connection_id: conn.id,
        last_seen_at: now,
      })),
      { onConflict: "organization_id,provider,external_id", ignoreDuplicates: false },
    );
    if (error) throw error;
    // Facebook do cliente: as contas encontradas já ficam com o cliente (as que ainda não têm cliente).
    if (conn.owner_kind === "client" && conn.client_id) {
      const { error: e2 } = await db.from("ad_accounts").update({ client_id: conn.client_id }).eq("connection_id", conn.id).is("client_id", null);
      if (e2) throw e2;
    }
  }
  await db.from("integration_connections").update({ accounts_synced_at: now, status: "active", last_error: null, last_checked_at: now }).eq("id", conn.id);
  return { managers: found.managers.length, accounts: found.accounts.length };
}

/** Desconecta: revoga na plataforma (melhor esforço) e apaga o token. As contas ficam, sem conexão. */
export async function removeConnection(conn: StoredConnection, revoke: (token: string) => Promise<void>) {
  try {
    await revoke(decrypt(conn.refresh_token_enc ?? conn.token_enc));
  } catch {
    // Token ilegível ou já revogado: segue apagando.
  }
  const { error } = await createAdminClient().from("integration_connections").delete().eq("id", conn.id);
  if (error) throw error;
}
