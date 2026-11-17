import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { LINK_TOKEN } from "./oauth";

export const hashLinkToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type ClientLinkState = "aberto" | "usado" | "cancelado" | "expirado";

export type ClientLink = {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  createdBy: string | null;
  state: ClientLinkState;
  usedAt: string | null;
};

/** Link de "conectar o Facebook" do cliente pelo código (só o hash é consultado). Uso do servidor. */
export async function getClientLink(token: string): Promise<ClientLink | null> {
  if (!LINK_TOKEN.test(token) || !process.env.SUPABASE_SECRET_KEY) return null;
  const { data: l } = await createAdminClient()
    .from("client_connect_links")
    .select("id, organization_id, client_id, created_by, expires_at, revoked_at, used_at, clients(name, deleted_at)")
    .eq("token_hash", hashLinkToken(token))
    .maybeSingle();
  if (!l) return null;
  const c = (Array.isArray(l.clients) ? l.clients[0] : l.clients) as { name: string; deleted_at: string | null } | null;
  if (!c || c.deleted_at) return null;
  const state: ClientLinkState = l.used_at ? "usado" : l.revoked_at ? "cancelado" : l.expires_at < new Date().toISOString() ? "expirado" : "aberto";
  return { id: l.id, organizationId: l.organization_id, clientId: l.client_id, clientName: c.name, createdBy: l.created_by, state, usedAt: l.used_at };
}

/** Marca o link como usado (uma vez só). Devolve false se outro retorno já usou. */
export async function markLinkUsed(id: string, connectionId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("client_connect_links")
    .update({ used_at: new Date().toISOString(), connection_id: connectionId })
    .eq("id", id)
    .is("used_at", null)
    .is("revoked_at", null)
    .select("id");
  return Boolean(data?.length);
}
