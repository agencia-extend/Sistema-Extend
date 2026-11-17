// Páginas do Facebook e Instagram dos clientes (RF-CON-02): leitura das respostas da Graph API, sem rede.

export type SocialPlatform = "facebook" | "instagram";

type Pic = { data?: { url?: string } };
export type MetaPage = {
  id: string;
  name: string;
  followers_count?: number;
  fan_count?: number;
  picture?: Pic;
  instagram_business_account?: { id: string; username?: string; name?: string; profile_picture_url?: string; followers_count?: number; media_count?: number };
};

export type ProfileRow = {
  platform: SocialPlatform;
  external_id: string;
  page_external_id: string | null;
  name: string;
  username: string | null;
  picture_url: string | null;
  followers: number | null;
  media_count: number | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

/** Página (e o Instagram ligado a ela) → linhas de perfil. */
export function profilesFromPage(p: MetaPage): ProfileRow[] {
  const out: ProfileRow[] = [
    { platform: "facebook", external_id: p.id, page_external_id: null, name: p.name || p.id, username: null, picture_url: p.picture?.data?.url ?? null, followers: num(p.followers_count) ?? num(p.fan_count), media_count: null },
  ];
  const ig = p.instagram_business_account;
  if (ig?.id) {
    out.push({
      platform: "instagram", external_id: ig.id, page_external_id: p.id, name: ig.name || ig.username || p.name, username: ig.username ?? null,
      picture_url: ig.profile_picture_url ?? null, followers: num(ig.followers_count), media_count: num(ig.media_count),
    });
  }
  return out;
}

export type PostRow = { external_id: string; media_type: string | null; caption: string | null; image_url: string | null; permalink: string | null; published_at: string; likes: number | null; comments: number | null; shares: number | null };

const clip = (s: string | undefined | null, n: number) => (s ? (s.length > n ? s.slice(0, n) : s) : null);

export type FbPost = { id: string; message?: string; created_time: string; full_picture?: string; permalink_url?: string; status_type?: string; shares?: { count?: number }; reactions?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } } };
export function postFromFacebook(p: FbPost): PostRow {
  return {
    external_id: p.id, media_type: p.status_type ?? null, caption: clip(p.message, 5000), image_url: p.full_picture ?? null, permalink: p.permalink_url ?? null,
    published_at: p.created_time, likes: num(p.reactions?.summary?.total_count), comments: num(p.comments?.summary?.total_count), shares: num(p.shares?.count) ?? 0,
  };
}

export type IgMedia = { id: string; caption?: string; media_type?: string; media_url?: string; thumbnail_url?: string; permalink?: string; timestamp: string; like_count?: number; comments_count?: number };
export function postFromInstagram(m: IgMedia): PostRow {
  return {
    external_id: m.id, media_type: m.media_type ?? null, caption: clip(m.caption, 5000),
    // Vídeo e reels: a capa (thumbnail_url); imagem e carrossel: a própria mídia.
    image_url: m.media_type === "VIDEO" ? (m.thumbnail_url ?? null) : (m.media_url ?? m.thumbnail_url ?? null),
    permalink: m.permalink ?? null, published_at: m.timestamp, likes: num(m.like_count), comments: num(m.comments_count), shares: null,
  };
}

export const MEDIA_TYPE_LABEL: Record<string, string> = { IMAGE: "Foto", VIDEO: "Vídeo", CAROUSEL_ALBUM: "Carrossel", REELS: "Reels" };

/** Erro de permissão da Graph API (código 10 ou 200–299). */
export const isPermissionError = (code: number | undefined) => code === 10 || (code !== undefined && code >= 200 && code < 300);

export const IG_PERMISSION_MESSAGE =
  "A conexão da Meta não tem a permissão do Instagram (instagram_basic). Inclua a permissão na configuração do login do app da Meta e reconecte em Configurações › Integrações.";
