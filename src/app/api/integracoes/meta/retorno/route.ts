import type { NextRequest } from "next/server";
import { MetaError, metaExchangeCode } from "@/lib/integrations/meta";
import { checkCallback } from "@/lib/integrations/oauth";
import { discoverAccounts, getConnection, recordFailure, saveConnection } from "@/lib/integrations/store";

/** Retorno do login da Meta: grava o token cifrado e busca os BMs e as contas de anúncio. */
export async function GET(request: NextRequest) {
  const c = await checkCallback(request, "meta");
  if (!c.ok) return c.response;
  let id: string;
  try {
    const t = await metaExchangeCode(c.code);
    id = await saveConnection({
      organizationId: c.user.organizationId,
      provider: "meta",
      purpose: "ads",
      owner: c.target.owner,
      profileId: c.target.owner === "user" ? c.user.id : null,
      method: "oauth",
      accountName: t.name,
      externalUserId: t.externalUserId,
      scopes: t.scopes,
      token: t.token,
      expiresAt: t.tokenExpiresAt ?? t.expiresAt,
      connectedBy: c.user.id,
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
