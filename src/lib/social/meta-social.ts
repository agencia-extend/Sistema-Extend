import "server-only";
import { IG_PERMISSION_MESSAGE, isPermissionError, postFromFacebook, postFromInstagram, profilesFromPage, type FbPost, type IgMedia, type MetaPage } from "@/domain/social";
import { MetaError, all, get, graph, tk } from "@/lib/integrations/meta";
import { accessToken, getConnection, recordFailure, type StoredConnection } from "@/lib/integrations/store";
import { createAdminClient } from "@/lib/supabase/admin";

// Páginas e Instagram dos clientes (RF-CON-02). Somente leitura na Meta. O token da página é pedido na hora com o
// token da conexão e não é guardado.

const PAGE_FIELDS =
  "id,name,followers_count,fan_count,picture{url},instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}";
const POSTS = 9;

/** Encontra as páginas (e o Instagram de cada uma) que a conexão alcança e grava/atualiza os perfis. */
export async function discoverProfiles(conn: StoredConnection, token: string): Promise<number> {
  const db = createAdminClient();
  const pages = await all<MetaPage>(graph(`/me/accounts?fields=${PAGE_FIELDS}&limit=100&${tk(token)}`), 1000);
  const now = new Date().toISOString();
  const rows = pages.flatMap(profilesFromPage).map((r) => ({ ...r, organization_id: conn.organization_id, connection_id: conn.id, last_seen_at: now }));
  if (!rows.length) return 0;
  const { error } = await db.from("social_profiles").upsert(rows, { onConflict: "organization_id,platform,external_id" });
  if (error) throw error;
  // Facebook do cliente: o que ele autorizou já fica com ele (se ainda não tem cliente).
  if (conn.owner_kind === "client" && conn.client_id) {
    const { error: e2 } = await db.from("social_profiles").update({ client_id: conn.client_id }).eq("connection_id", conn.id).is("client_id", null);
    if (e2) throw e2;
  }
  return rows.length;
}

type ProfileRow = { id: string; platform: string; external_id: string; connection_id: string | null };

/** Últimas publicações de um perfil. Erro de permissão do Instagram vira mensagem clara no perfil. */
async function syncPosts(p: ProfileRow, token: string): Promise<number> {
  const db = createAdminClient();
  let rows;
  try {
    if (p.platform === "facebook") {
      const page = await get<{ access_token?: string }>(graph(`/${p.external_id}?fields=access_token&${tk(token)}`));
      const pageToken = page.access_token ?? token;
      // Reações e comentários da página pedem permissão que o app não tem (conferido: erro 10); ficam de fora.
      const data = await get<{ data: FbPost[] }>(
        graph(`/${p.external_id}/posts?fields=id,message,created_time,full_picture,permalink_url,status_type,shares&limit=${POSTS}&${tk(pageToken)}`),
      );
      rows = data.data.map(postFromFacebook);
    } else {
      const data = await get<{ data: IgMedia[] }>(
        graph(`/${p.external_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${POSTS}&${tk(token)}`),
      );
      rows = data.data.map(postFromInstagram);
    }
  } catch (e) {
    const message = e instanceof MetaError ? (p.platform === "instagram" && isPermissionError(e.code) ? IG_PERMISSION_MESSAGE : e.message) : "Falha ao buscar as publicações. Tente de novo.";
    await db.from("social_profiles").update({ sync_error: message }).eq("id", p.id);
    if (e instanceof MetaError && e.expired) throw e;
    return 0;
  }
  // Fica só o que a Meta devolveu agora (as últimas): o resto sai.
  await db.from("social_posts").delete().eq("profile_id", p.id);
  if (rows.length) {
    const { error } = await db.from("social_posts").insert(rows.map((r) => ({ ...r, profile_id: p.id })));
    if (error) throw error;
  }
  await db.from("social_profiles").update({ posts_synced_at: new Date().toISOString(), sync_error: null }).eq("id", p.id);
  return rows.length;
}

/**
 * Atualiza perfis e publicações. clientId limita a um cliente ("Atualizar agora"). Conexões do cliente primeiro e a da
 * agência por último, para a da agência ficar como responsável pelas páginas que as duas alcançam.
 */
export async function syncSocial(opts: { clientId?: string; budgetMs?: number } = {}) {
  const db = createAdminClient();
  const started = Date.now();
  const budget = opts.budgetMs ?? 45_000;
  const { data: conns, error } = await db
    .from("integration_connections")
    .select("id, owner_kind")
    .eq("provider", "meta")
    .eq("purpose", "ads")
    .eq("status", "active")
    .order("owner_kind", { ascending: true }); // "agency" < "client" < "user": inverte abaixo
  if (error) throw error;
  const ordered = [...(conns ?? [])].sort((a, b) => (a.owner_kind === "agency" ? 1 : 0) - (b.owner_kind === "agency" ? 1 : 0));
  const out = { profiles: 0, posts: 0, errors: [] as string[] };
  const tokens = new Map<string, string>();

  for (const c of ordered) {
    const conn = await getConnection(c.id);
    if (!conn) continue;
    try {
      const token = await accessToken(conn);
      tokens.set(conn.id, token);
      out.profiles += await discoverProfiles(conn, token);
    } catch (e) {
      out.errors.push(await recordFailure(conn, e));
    }
  }

  let q = db.from("social_profiles").select("id, platform, external_id, connection_id").not("client_id", "is", null).not("connection_id", "is", null).order("posts_synced_at", { ascending: true, nullsFirst: true });
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  const { data: profiles, error: pe } = await q;
  if (pe) throw pe;
  for (const p of (profiles ?? []) as ProfileRow[]) {
    if (Date.now() - started > budget) break;
    const token = tokens.get(p.connection_id!);
    if (!token) {
      await db.from("social_profiles").update({ sync_error: "A conexão da Meta que encontrou esta página está parada. Reconecte em Configurações › Integrações." }).eq("id", p.id);
      continue;
    }
    try {
      out.posts += await syncPosts(p, token);
    } catch (e) {
      const conn = await getConnection(p.connection_id!);
      if (conn) out.errors.push(await recordFailure(conn, e));
      tokens.delete(p.connection_id!);
    }
  }
  return out;
}
