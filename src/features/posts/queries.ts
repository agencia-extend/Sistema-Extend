import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PostFormat, PostStatus } from "@/domain/posts";
import type { SocialPlatform } from "@/domain/social";

export type PostRow = {
  id: string;
  clientId: string;
  clientName: string | null;
  platform: SocialPlatform;
  profileName: string;
  format: PostFormat;
  caption: string;
  imageCount: number;
  hasVideo: boolean;
  thumbUrl: string | null;
  scheduledAt: string;
  status: PostStatus;
  permalink: string | null;
  error: string | null;
  authorName: string | null;
};

type Raw = {
  id: string; client_id: string; format: string; caption: string; images: string[]; video_path: string | null; video_drive_id: string | null;
  scheduled_at: string; status: string; permalink: string | null; error: string | null;
  profile: { platform: string; name: string; username: string | null } | null; client: { name: string } | null; author: { full_name: string } | null;
};

const SELECT =
  "id, client_id, format, caption, images, video_path, video_drive_id, scheduled_at, status, permalink, error, profile:social_profiles(platform, name, username), client:clients(name), author:profiles!post_schedules_created_by_fkey(full_name)";

async function toRows(raw: Raw[]): Promise<PostRow[]> {
  const supabase = await createClient();
  const firsts = raw.map((r) => r.images[0]).filter(Boolean);
  const signed = firsts.length ? ((await supabase.storage.from("publicacoes").createSignedUrls(firsts, 600)).data ?? []) : [];
  return raw.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.client?.name ?? null,
    platform: (r.profile?.platform ?? "facebook") as SocialPlatform,
    profileName: r.profile?.username ? `@${r.profile.username}` : (r.profile?.name ?? "—"),
    format: r.format as PostFormat,
    caption: r.caption,
    imageCount: r.images.length,
    hasVideo: Boolean(r.video_path || r.video_drive_id),
    thumbUrl: r.images[0] ? (signed.find((s) => s.path === r.images[0])?.signedUrl ?? null) : null,
    scheduledAt: r.scheduled_at,
    status: r.status as PostStatus,
    permalink: r.permalink,
    error: r.error,
    authorName: r.author?.full_name ?? null,
  }));
}

/** Programação do cliente: o que está para sair e o dos últimos 30 dias. */
export async function getClientPosts(clientId: string): Promise<PostRow[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("post_schedules")
    .select(SELECT)
    .eq("client_id", clientId)
    .or(`scheduled_at.gte.${since},status.in.(agendado,publicando)`)
    .order("scheduled_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return toRows((data ?? []) as unknown as Raw[]);
}

/** Publicações de um período que a pessoa vê (agenda geral). */
export async function listPosts(range: { from: string; to: string }): Promise<PostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("post_schedules").select(SELECT).gte("scheduled_at", range.from).lt("scheduled_at", range.to).order("scheduled_at").limit(500);
  if (error) throw error;
  return toRows((data ?? []) as unknown as Raw[]);
}

export type PublishTarget = { profileId: string; platform: SocialPlatform; label: string; missing: string[] };

/** Perfis do cliente onde dá (ou ainda não dá) para publicar. */
export async function getPublishTargets(clientId: string): Promise<PublishTarget[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_targets", { p_client: clientId });
  if (error) throw error;
  return (data ?? []).map((t) => ({ profileId: t.profile_id, platform: t.platform as SocialPlatform, label: t.username ? `@${t.username}` : t.name, missing: t.missing ?? [] }));
}

/** Conteúdo do cronograma para preencher a programação (RF-CON-04). */
export async function getContentForPost(taskId: string, clientId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("id, title, task_content(format, caption, post_on)").eq("id", taskId).eq("client_id", clientId).maybeSingle();
  if (!data) return null;
  const tc = (Array.isArray(data.task_content) ? data.task_content[0] : data.task_content) as { format: string | null; caption: string | null; post_on: string | null } | null;
  return { taskId: data.id, title: data.title, format: tc?.format ?? null, caption: tc?.caption ?? "", postOn: tc?.post_on ?? null };
}
