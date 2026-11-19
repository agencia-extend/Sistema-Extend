import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SocialPlatform } from "@/domain/social";
import { listConnections } from "@/features/integrations/queries";

// Leitura com o login da pessoa: a RLS mostra os perfis dos clientes que ela vê (e os sem cliente para quem conecta).

export type SocialProfileView = {
  id: string;
  platform: SocialPlatform;
  externalId: string;
  name: string;
  username: string | null;
  pictureUrl: string | null;
  followers: number | null;
  mediaCount: number | null;
  clientId: string | null;
  clientName: string | null;
  postsSyncedAt: string | null;
  syncError: string | null;
  lastSeenAt: string;
  viaClient: boolean;
};

export type SocialPost = { externalId: string; mediaType: string | null; caption: string | null; imageUrl: string | null; permalink: string | null; publishedAt: string; likes: number | null; comments: number | null; shares: number | null };

const SELECT = "id, platform, external_id, name, username, picture_url, followers, media_count, client_id, posts_synced_at, sync_error, last_seen_at, client:clients(name), connection_id";

type Raw = {
  id: string; platform: string; external_id: string; name: string; username: string | null; picture_url: string | null; followers: number | null; media_count: number | null;
  client_id: string | null; posts_synced_at: string | null; sync_error: string | null; last_seen_at: string; client: { name: string } | null; connection_id: string | null;
};

const toView = (r: Raw, fromClient: Set<string> = new Set()): SocialProfileView => ({
  id: r.id, platform: r.platform as SocialPlatform, externalId: r.external_id, name: r.name, username: r.username, pictureUrl: r.picture_url,
  followers: r.followers, mediaCount: r.media_count, clientId: r.client_id, clientName: r.client?.name ?? null, postsSyncedAt: r.posts_synced_at,
  syncError: r.sync_error, lastSeenAt: r.last_seen_at, viaClient: Boolean(r.connection_id && fromClient.has(r.connection_id)),
});

/** Todas as páginas e perfis da agência (Configurações › Integrações). Facebook e o Instagram dele lado a lado. */
export async function listSocialProfiles(): Promise<SocialProfileView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("social_profiles").select(SELECT).order("name").order("platform");
  if (error) throw error;
  // A conexão não é lida direto pela pessoa: vem da lista de conexões (como nas contas de anúncio).
  const fromClient = new Set((await listConnections()).filter((c) => c.owner === "client").map((c) => c.id));
  return ((data ?? []) as unknown as Raw[]).map((r) => toView(r, fromClient));
}

/** Perfis do cliente com as últimas publicações (aba Redes sociais). */
export async function getClientSocial(clientId: string): Promise<{ profile: SocialProfileView; posts: SocialPost[] }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("social_profiles").select(SELECT).eq("client_id", clientId).order("platform", { ascending: false }).order("name");
  if (error) throw error;
  const profiles = ((data ?? []) as unknown as Raw[]).map((r) => toView(r));
  if (!profiles.length) return [];
  const { data: posts, error: pe } = await supabase
    .from("social_posts")
    .select("profile_id, external_id, media_type, caption, image_url, permalink, published_at, likes, comments, shares")
    .in("profile_id", profiles.map((p) => p.id))
    .order("published_at", { ascending: false });
  if (pe) throw pe;
  return profiles.map((profile) => ({
    profile,
    posts: (posts ?? []).filter((p) => p.profile_id === profile.id).map((p) => ({
      externalId: p.external_id, mediaType: p.media_type, caption: p.caption, imageUrl: p.image_url, permalink: p.permalink, publishedAt: p.published_at, likes: p.likes, comments: p.comments, shares: p.shares,
    })),
  }));
}

/** Perfis ligados a clientes que a pessoa vê (estúdio de publicações). A RLS decide quais. */
export async function listClientProfiles(): Promise<SocialProfileView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("social_profiles").select(SELECT).not("client_id", "is", null).order("name").order("platform");
  if (error) throw error;
  return ((data ?? []) as unknown as Raw[]).map((r) => toView(r));
}
