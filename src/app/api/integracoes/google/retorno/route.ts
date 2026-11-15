import type { NextRequest } from "next/server";
import { GoogleError, googleExchangeCode, googlePrimaryCalendar } from "@/lib/integrations/google";
import { checkCallback } from "@/lib/integrations/oauth";
import { discoverAccounts, getConnection, recordFailure, saveConnection } from "@/lib/integrations/store";

/** Retorno do login do Google: Google Ads da agência (busca MCCs e contas) ou Google Agenda da pessoa. */
export async function GET(request: NextRequest) {
  const c = await checkCallback(request, "google");
  if (!c.ok) return c.response;
  const { purpose, owner } = c.target;
  let id: string;
  let accountName: string;
  try {
    const t = await googleExchangeCode(c.code);
    const needed = purpose === "calendar" ? "https://www.googleapis.com/auth/calendar.events" : "https://www.googleapis.com/auth/adwords";
    if (!t.scopes.includes(needed)) return c.back("erro=escopo");
    accountName = t.email;
    if (purpose === "calendar") accountName = (await googlePrimaryCalendar(t.access_token)).name;
    id = await saveConnection({
      organizationId: c.user.organizationId,
      provider: "google",
      purpose,
      owner,
      profileId: owner === "user" ? c.user.id : null,
      method: "oauth",
      accountName,
      accountEmail: t.email,
      externalUserId: t.sub,
      scopes: t.scopes,
      token: t.access_token,
      refreshToken: t.refresh_token ?? null,
      expiresAt: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      connectedBy: c.user.id,
    });
  } catch (e) {
    return c.back(`erro=troca&detalhe=${encodeURIComponent(e instanceof GoogleError ? e.message : "Não foi possível concluir a conexão com o Google.")}`);
  }
  if (purpose === "calendar") return c.back("conectado=agenda");
  const conn = await getConnection(id);
  try {
    const r = await discoverAccounts(conn!);
    return c.back(`conectado=google&contas=${r.accounts}`);
  } catch (e) {
    const message = await recordFailure(conn!, e);
    return c.back(`conectado=google&detalhe=${encodeURIComponent(message)}`);
  }
}
