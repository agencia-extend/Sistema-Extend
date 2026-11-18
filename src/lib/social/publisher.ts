import "server-only";
import { driveDownloadUrl, publishErrorMessage, type PostFormat } from "@/domain/posts";
import { graph } from "@/lib/integrations/meta";
import { accessToken, getConnection } from "@/lib/integrations/store";
import { createAdminClient } from "@/lib/supabase/admin";

// Publica no Facebook e no Instagram o que venceu na fila (RF-CON-03). A Meta baixa a mídia de links assinados do
// Storage (válidos por 1 hora) ou do Drive (arquivo público). Cada publicação é isolada: uma falha não para as outras.

class GraphFailure extends Error {
  code?: number;
  detail?: string;
  constructor(code?: number, detail?: string) {
    super("meta_api");
    this.code = code;
    this.detail = detail;
  }
}

async function call<T>(path: string, token: string, body?: Record<string, string>, timeoutMs = 30_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(graph(path) + (body ? "" : `${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`), {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
      body: body ? new URLSearchParams({ ...body, locale: "pt_BR", access_token: token }) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new GraphFailure(undefined, "sem resposta da Meta (rede)");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: { code?: number; error_user_msg?: string; message?: string } };
  if (!res.ok || data.error) throw new GraphFailure(data.error?.code, data.error?.error_user_msg ?? data.error?.message);
  return data;
}

type Plan = { format: PostFormat; caption: string; imageUrls: string[]; videoUrl: string | null };
type Result = { done: true; externalId: string; permalink: string | null } | { done: false; containerId: string };

async function uploadVideo(kind: "video_reels" | "video_stories", pageId: string, token: string, videoUrl: string) {
  const started = await call<{ video_id: string; upload_url?: string }>(`/${pageId}/${kind}`, token, { upload_phase: "start" });
  const res = await fetch(started.upload_url ?? `https://rupload.facebook.com/video-upload/${graph("").split("/").pop()}/${started.video_id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_url: videoUrl },
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new GraphFailure(undefined, `a Meta não conseguiu baixar o vídeo (${res.status})`);
  return started.video_id;
}

async function publishFacebook(pageId: string, token: string, p: Plan): Promise<Result> {
  const link = (id: string) => `https://www.facebook.com/${id}`;
  if (p.format === "stories") {
    if (p.videoUrl) {
      const id = await uploadVideo("video_stories", pageId, token, p.videoUrl);
      const done = await call<{ post_id?: string }>(`/${pageId}/video_stories`, token, { upload_phase: "finish", video_id: id });
      return { done: true, externalId: done.post_id ?? id, permalink: null };
    }
    const photo = await call<{ id: string }>(`/${pageId}/photos`, token, { url: p.imageUrls[0], published: "false" });
    const done = await call<{ post_id?: string }>(`/${pageId}/photo_stories`, token, { photo_id: photo.id });
    return { done: true, externalId: done.post_id ?? photo.id, permalink: null };
  }
  if (p.format === "reels" && p.videoUrl) {
    const id = await uploadVideo("video_reels", pageId, token, p.videoUrl);
    await call(`/${pageId}/video_reels`, token, { upload_phase: "finish", video_id: id, video_state: "PUBLISHED", description: p.caption });
    return { done: true, externalId: id, permalink: `https://www.facebook.com/reel/${id}` };
  }
  if (p.videoUrl) {
    const r = await call<{ id: string }>(`/${pageId}/videos`, token, { file_url: p.videoUrl, description: p.caption }, 55_000);
    return { done: true, externalId: r.id, permalink: link(r.id) };
  }
  if (p.imageUrls.length === 1) {
    const r = await call<{ id: string; post_id?: string }>(`/${pageId}/photos`, token, { url: p.imageUrls[0], caption: p.caption });
    return { done: true, externalId: r.post_id ?? r.id, permalink: link(r.post_id ?? r.id) };
  }
  // Várias fotos: sobem sem publicar e entram juntas no mesmo post.
  const attached: string[] = [];
  for (const url of p.imageUrls) attached.push((await call<{ id: string }>(`/${pageId}/photos`, token, { url, published: "false" })).id);
  const body: Record<string, string> = { message: p.caption };
  attached.forEach((id, i) => (body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
  const r = await call<{ id: string }>(`/${pageId}/feed`, token, body);
  return { done: true, externalId: r.id, permalink: link(r.id) };
}

/** Instagram: cria o contêiner (a Meta baixa a mídia); vídeo precisa terminar de processar antes de publicar. */
async function instagramContainer(igId: string, token: string, p: Plan): Promise<string> {
  if (p.format === "stories")
    return (await call<{ id: string }>(`/${igId}/media`, token, { media_type: "STORIES", ...(p.videoUrl ? { video_url: p.videoUrl } : { image_url: p.imageUrls[0] }) })).id;
  if (p.videoUrl) return (await call<{ id: string }>(`/${igId}/media`, token, { media_type: "REELS", video_url: p.videoUrl, caption: p.caption })).id;
  if (p.imageUrls.length === 1) return (await call<{ id: string }>(`/${igId}/media`, token, { image_url: p.imageUrls[0], caption: p.caption })).id;
  const children: string[] = [];
  for (const url of p.imageUrls) children.push((await call<{ id: string }>(`/${igId}/media`, token, { image_url: url, is_carousel_item: "true" })).id);
  return (await call<{ id: string }>(`/${igId}/media`, token, { media_type: "CAROUSEL", children: children.join(","), caption: p.caption })).id;
}

type Due = { id: string; organization_id: string; client_id: string; profile_id: string; container_id: string | null; attempts: number };

async function publishOne(s: Due) {
  const db = createAdminClient();
  const finish = (status: "publicado" | "erro" | "publicando", externalId: string | null, permalink: string | null, error: string | null, container: string | null = null) =>
    db.rpc("finish_post", { p_id: s.id, p_status: status, p_external: externalId as string, p_permalink: permalink as string, p_error: error as string, p_container: container as string });

  const [{ data: post }, { data: profile }] = await Promise.all([
    db.from("post_schedules").select("format, caption, images, video_path, video_drive_id").eq("id", s.id).single(),
    db.from("social_profiles").select("platform, external_id, connection_id").eq("id", s.profile_id).single(),
  ]);
  if (!post || !profile) return finish("erro", null, null, "A publicação ou o perfil não existe mais.");
  const conn = profile.connection_id ? await getConnection(profile.connection_id) : null;
  if (!conn || conn.status !== "active") return finish("erro", null, null, "A conexão da Meta deste perfil está parada. Reconecte em Configurações › Integrações e reagende.");

  try {
    const token = await accessToken(conn);
    // Links assinados do Storage, válidos durante a publicação.
    const paths = [...(post.images ?? []), ...(post.video_path ? [post.video_path] : [])];
    const signed = paths.length ? (await db.storage.from("publicacoes").createSignedUrls(paths, 3600)).data ?? [] : [];
    const urlOf = (p: string) => signed.find((x) => x.path === p)?.signedUrl ?? null;
    const imageUrls = (post.images ?? []).map(urlOf).filter((u): u is string => Boolean(u));
    const videoUrl = post.video_path ? urlOf(post.video_path) : post.video_drive_id ? driveDownloadUrl(post.video_drive_id) : null;
    if (imageUrls.length !== (post.images ?? []).length || (post.video_path && !videoUrl)) return finish("erro", null, null, "Um dos arquivos da publicação não foi encontrado. Reagende com a mídia de novo.");
    const plan: Plan = { format: post.format as PostFormat, caption: post.caption ?? "", imageUrls, videoUrl };

    if (profile.platform === "facebook") {
      const page = await call<{ access_token?: string }>(`/${profile.external_id}?fields=access_token`, token);
      const r = await publishFacebook(profile.external_id, page.access_token ?? token, plan);
      if (r.done) return finish("publicado", r.externalId, r.permalink, null);
      return;
    }

    let container = s.container_id;
    if (!container) container = await instagramContainer(profile.external_id, token, plan);
    const state = await call<{ status_code?: string; status?: string }>(`/${container}?fields=status_code,status`, token);
    if (state.status_code === "ERROR" || state.status_code === "EXPIRED")
      return finish("erro", null, null, `O Instagram não processou a mídia${state.status ? `: ${state.status}` : "."} Se o vídeo é do Drive, confira se o link está aberto para qualquer pessoa.`.slice(0, 480));
    if (state.status_code === "IN_PROGRESS") {
      if (s.attempts >= 8) return finish("erro", null, null, "O Instagram demorou demais para processar o vídeo. Reagende.");
      return finish("publicando", null, null, null, container);
    }
    const r = await call<{ id: string }>(`/${profile.external_id}/media_publish`, token, { creation_id: container });
    const media = await call<{ permalink?: string }>(`/${r.id}?fields=permalink`, token).catch(() => ({ permalink: undefined }));
    return finish("publicado", r.id, media.permalink ?? null, null);
  } catch (e) {
    const f = e instanceof GraphFailure ? e : new GraphFailure(undefined, undefined);
    if (!(e instanceof GraphFailure)) console.error("[publicacoes]", (e as Error)?.message ?? e);
    return finish("erro", null, null, publishErrorMessage(f.code, f.detail));
  }
}

/** Job da fila (a cada 5 minutos). */
export async function runPublisher() {
  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_due_posts", { p_limit: 10 });
  if (error) throw error;
  const due = (data ?? []) as Due[];
  for (const s of due) {
    try {
      await publishOne(s);
    } catch (e) {
      console.error("[publicacoes] falha inesperada", (e as Error)?.message ?? e);
      await db.rpc("finish_post", { p_id: s.id, p_status: "erro", p_external: null as unknown as string, p_permalink: null as unknown as string, p_error: "Falha inesperada ao publicar. Reagende.", p_container: null as unknown as string });
    }
  }
  return { claimed: due.length };
}
