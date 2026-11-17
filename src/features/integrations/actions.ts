"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { configured } from "@/lib/integrations/config";
import { googleRevoke } from "@/lib/integrations/google";
import { MetaError, metaRevoke, metaWhoAmI } from "@/lib/integrations/meta";
import { discoverAccounts, getConnection, recordFailure, removeConnection, saveConnection, type StoredConnection } from "@/lib/integrations/store";
import type { CurrentUser } from "@/lib/auth/dal";
import { randomBytes } from "node:crypto";
import { hashLinkToken } from "@/lib/integrations/client-links";
import { publicEnv } from "@/lib/env";
import { adAccountSchema, clientAccountSchema, clientIdSchema, connectionIdSchema, linkIdSchema, systemTokenSchema } from "./schemas";

const PAGE = "/configuracoes/integracoes";
const PROFILE = "/configuracoes/perfil";

/** A conexão é da agência (exige ads.connect), da própria pessoa ou de um cliente de que a pessoa cuida no tráfego. */
async function ownConnection(id: string, user: CurrentUser): Promise<StoredConnection | null> {
  const conn = await getConnection(id);
  if (!conn || conn.organization_id !== user.organizationId) return null;
  if (conn.owner_kind === "client") return conn.client_id && (await canManageClientAds(conn.client_id)) ? conn : null;
  if (conn.owner_kind === "agency" ? !user.permissions["ads.connect"] : conn.profile_id !== user.id) return null;
  return conn;
}

async function canManageClientAds(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_client_ads", { p_client: clientId });
  return data === true;
}

const clientPage = (clientId: string) => `/clientes/${clientId}/trafego`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Meta da agência pelo token de usuário do sistema do BM (não vence a cada 60 dias). */
export const saveMetaSystemToken = defineAction({ schema: systemTokenSchema, permission: "ads.connect" }, async ({ token }, { user }) => {
  if (!configured("meta")) return fail("business_rule", "Configure o app da Meta (META_APP_ID e META_APP_SECRET) antes de colar o token.");
  let who: Awaited<ReturnType<typeof metaWhoAmI>>;
  try {
    who = await metaWhoAmI(token);
  } catch (e) {
    return fail("business_rule", e instanceof MetaError ? e.message : "Não foi possível validar o token com a Meta.");
  }
  const id = await saveConnection({
    organizationId: user.organizationId,
    provider: "meta",
    purpose: "ads",
    owner: "agency",
    profileId: null,
    method: "system_user",
    accountName: who.name,
    externalUserId: who.externalUserId,
    scopes: who.scopes,
    token,
    expiresAt: who.tokenExpiresAt,
    connectedBy: user.id,
  });
  revalidatePath(PAGE);
  const conn = (await getConnection(id))!;
  try {
    const r = await discoverAccounts(conn);
    return ok(null, `Meta conectada. ${plural(r.accounts, "conta de anúncio encontrada", "contas de anúncio encontradas")}.`);
  } catch (e) {
    return fail("business_rule", `Token salvo, mas a busca das contas falhou: ${await recordFailure(conn, e)}`);
  }
});

/** Busca de novo os BMs/MCCs e as contas de anúncio da conexão. */
export const refreshAccounts = defineAction({ schema: connectionIdSchema }, async ({ connectionId }, { user }) => {
  const conn = await ownConnection(connectionId, user);
  if (!conn) return fail("forbidden", "Você não tem permissão para esta conexão.");
  if (conn.purpose !== "ads") return fail("business_rule", "Esta conexão não tem contas de anúncio.");
  try {
    const r = await discoverAccounts(conn);
    revalidatePath(PAGE);
    revalidatePath(PROFILE);
    if (conn.client_id) revalidatePath(clientPage(conn.client_id));
    return ok(null, `Contas atualizadas: ${plural(r.accounts, "conta encontrada", "contas encontradas")}.`);
  } catch (e) {
    const message = await recordFailure(conn, e);
    revalidatePath(PAGE);
    revalidatePath(PROFILE);
    return fail("network", message);
  }
});

/** Desconecta (revoga na plataforma). Conexão da agência avisa quem mais cuida das integrações. */
export const disconnect = defineAction({ schema: connectionIdSchema }, async ({ connectionId }, { user }) => {
  const conn = await ownConnection(connectionId, user);
  if (!conn) return fail("forbidden", "Você não tem permissão para esta conexão.");
  await removeConnection(conn, conn.provider === "meta" ? metaRevoke : googleRevoke);
  if (conn.owner_kind === "agency") {
    await createAdminClient().rpc("notify_perm_holders", {
      p_org: user.organizationId,
      p_perm: "ads.connect",
      p_kind: "ad_alert",
      p_title: `Conexão com ${conn.provider === "meta" ? "a Meta" : "o Google Ads"} desligada`,
      p_body: `${user.fullName} desconectou. Os dados dessas contas param de chegar até alguém conectar de novo.`,
      p_href: PAGE,
      p_dedupe: `integracao-off:${conn.id}`,
      p_actor: user.id,
    });
  }
  revalidatePath(PAGE);
  revalidatePath(PROFILE);
  if (conn.client_id) revalidatePath(clientPage(conn.client_id));
  return ok(null, "Conexão desligada.");
});

/** Inclui ou tira a conta do sistema e liga a um cliente (a RPC confere a permissão no banco). */
export const saveAdAccount = defineAction({ schema: adAccountSchema, permission: "ads.connect" }, async ({ id, enabled, clientId }) => {
  const supabase = await createClient();
  must(await supabase.rpc("save_ad_account", { p_id: id, p_enabled: enabled, p_client: clientId as string }));
  revalidatePath(PAGE);
  return ok(null, enabled ? "Conta incluída." : clientId ? "Cliente salvo." : "Conta retirada.");
});

/** Link para o cliente autorizar o Facebook dele (vale 7 dias; gerar outro cancela o anterior). */
export const createClientConnectLink = defineAction({ schema: clientIdSchema, permission: "ads.manage" }, async ({ clientId }) => {
  if (!configured("meta")) return fail("business_rule", "O app da Meta ainda não está configurado no servidor.");
  const token = randomBytes(32).toString("base64url");
  const supabase = await createClient();
  must(await supabase.rpc("create_client_connect_link", { p_client: clientId, p_token_hash: hashLinkToken(token), p_days: 7 }));
  revalidatePath(clientPage(clientId));
  return ok({ url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/conectar/${token}` }, "Link gerado. Copie e envie ao cliente.");
});

export const revokeClientConnectLink = defineAction({ schema: linkIdSchema, permission: "ads.manage" }, async ({ id, clientId }) => {
  const supabase = await createClient();
  must(await supabase.rpc("revoke_client_connect_link", { p_id: id }));
  revalidatePath(clientPage(clientId));
  return ok(null, "Link cancelado.");
});

/** Conta encontrada pelo Facebook do cliente: entra ou sai do sistema (a RPC confere no banco). */
export const toggleClientAdAccount = defineAction({ schema: clientAccountSchema, permission: "ads.manage" }, async ({ id, clientId, enabled }) => {
  const supabase = await createClient();
  must(await supabase.rpc("toggle_client_ad_account", { p_id: id, p_enabled: enabled }));
  revalidatePath(clientPage(clientId));
  revalidatePath(PAGE);
  return ok(null, enabled ? "Conta incluída no sistema." : "Conta retirada do sistema.");
});
