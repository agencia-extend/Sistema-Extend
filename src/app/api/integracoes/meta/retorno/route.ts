import type { NextRequest } from "next/server";
import { MetaError, metaExchangeCode } from "@/lib/integrations/meta";
import { checkCallback } from "@/lib/integrations/oauth";
import { getClientLink, markLinkUsed } from "@/lib/integrations/client-links";
import { discoverAccounts, getConnection, recordFailure, saveConnection } from "@/lib/integrations/store";
import { createAdminClient } from "@/lib/supabase/admin";

const plural = (n: number) => `${n} ${n === 1 ? "conta de anúncio encontrada" : "contas de anúncio encontradas"}`;

/**
 * Retorno do login da Meta: grava o token cifrado e busca os BMs e as contas de anúncio.
 * Serve a conexão da agência, a pessoal, a do cliente feita pelo gestor e a do link enviado ao cliente.
 */
export async function GET(request: NextRequest) {
  const c = await checkCallback(request, "meta");
  if (!c.ok) return c.response;

  // Link do cliente: quem autoriza é o próprio cliente, sem login no sistema.
  if (c.via === "link") {
    const link = await getClientLink(c.linkToken);
    if (!link || link.state !== "aberto") return c.back(`erro=${link ? link.state : "link"}`);
    let id: string;
    try {
      const t = await metaExchangeCode(c.code);
      id = await saveConnection({
        organizationId: link.organizationId,
        provider: "meta",
        purpose: "ads",
        owner: "client",
        profileId: null,
        clientId: link.clientId,
        method: "oauth",
        accountName: t.name,
        externalUserId: t.externalUserId,
        scopes: t.scopes,
        token: t.token,
        expiresAt: t.tokenExpiresAt ?? t.expiresAt,
        connectedBy: link.createdBy,
      });
    } catch (e) {
      return c.back(`erro=troca&detalhe=${encodeURIComponent(e instanceof MetaError ? e.message : "Não foi possível concluir a conexão com a Meta.")}`);
    }
    await markLinkUsed(link.id, id);
    const conn = (await getConnection(id))!;
    let found: string;
    try {
      found = plural((await discoverAccounts(conn)).accounts);
    } catch (e) {
      found = `a busca das contas falhou: ${await recordFailure(conn, e)}`;
    }
    await createAdminClient().rpc("notify_client_ads_team", {
      p_client: link.clientId,
      p_extra: link.createdBy as string,
      p_title: `${link.clientName} conectou o Facebook`,
      p_body: `O cliente autorizou pelo link: ${found}. Escolha quais contas entram no sistema.`,
      p_href: `/clientes/${link.clientId}/trafego#facebook`,
      p_dedupe: `facebook-cliente:${link.id}`,
    });
    return c.back("conectado=1");
  }

  const { user, target } = c;
  let id: string;
  try {
    const t = await metaExchangeCode(c.code);
    id = await saveConnection({
      organizationId: user.organizationId,
      provider: "meta",
      purpose: "ads",
      owner: target.owner,
      profileId: target.owner === "user" ? user.id : null,
      clientId: target.owner === "client" ? target.clientId : null,
      method: "oauth",
      accountName: t.name,
      externalUserId: t.externalUserId,
      scopes: t.scopes,
      token: t.token,
      expiresAt: t.tokenExpiresAt ?? t.expiresAt,
      connectedBy: user.id,
    });
  } catch (e) {
    return c.back(`erro=troca&detalhe=${encodeURIComponent(e instanceof MetaError ? e.message : "Não foi possível concluir a conexão com a Meta.")}`);
  }
  const conn = await getConnection(id);
  try {
    const r = await discoverAccounts(conn!);
    return c.back(`conectado=meta&contas=${r.accounts}`);
  } catch (e) {
    const message = await recordFailure(conn!, e);
    return c.back(`conectado=meta&detalhe=${encodeURIComponent(message)}`);
  }
}
