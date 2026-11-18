// Programar publicações no Facebook e no Instagram (RF-CON-03): formatos, limites e mensagens. Sem rede.

export const POST_FORMATS = ["feed", "reels", "video", "stories"] as const;
export type PostFormat = (typeof POST_FORMATS)[number];
export const POST_FORMAT_LABEL: Record<PostFormat, string> = { feed: "Feed (foto ou carrossel)", reels: "Reels", video: "Vídeo", stories: "Stories" };
export const POST_FORMAT_SHORT: Record<PostFormat, string> = { feed: "Feed", reels: "Reels", video: "Vídeo", stories: "Stories" };

export type PostStatus = "agendado" | "publicando" | "publicado" | "erro" | "cancelado";
export const POST_STATUS_LABEL: Record<PostStatus, string> = { agendado: "Agendado", publicando: "Publicando", publicado: "Publicado", erro: "Não publicou", cancelado: "Cancelado" };

export const MAX_IMAGES = 10;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
export const IG_CAPTION_MAX = 2200;
export const IG_HASHTAG_MAX = 30;

export type PostMedia = { images: number; videos: number; caption: string };

/** O que o formato pede (mesma regra do banco em schedule_post). */
export function formatProblem(format: PostFormat, m: PostMedia): string | null {
  if (m.videos > 1) return "Use um vídeo só: o arquivo ou o link do Drive.";
  if (format === "feed") return m.videos > 0 || m.images === 0 ? "Feed leva de 1 a 10 imagens. Para vídeo, use Reels ou Vídeo." : m.images > MAX_IMAGES ? `Até ${MAX_IMAGES} imagens no carrossel.` : null;
  if (format === "stories") return m.images + m.videos === 1 ? null : "Stories leva uma imagem ou um vídeo.";
  return m.videos === 1 && m.images === 0 ? null : "Reels e Vídeo levam um vídeo, sem imagens.";
}

/** Limites do Instagram na legenda. */
export function instagramCaptionProblem(caption: string): string | null {
  if (caption.length > IG_CAPTION_MAX) return "A legenda do Instagram aceita até 2.200 caracteres.";
  if ((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > IG_HASHTAG_MAX) return "O Instagram aceita até 30 hashtags.";
  return null;
}

/** Id do arquivo num link do Google Drive (o arquivo precisa estar com "qualquer pessoa com o link"). */
export function driveFileId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !["drive.google.com", "docs.google.com", "drive.usercontent.google.com"].includes(url.hostname)) return null;
  const id = /\/(?:file\/)?d\/([A-Za-z0-9_-]{10,})/.exec(url.pathname)?.[1] ?? url.searchParams.get("id");
  return id && /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : null;
}
export const driveDownloadUrl = (id: string) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;

/** Data e hora de São Paulo (sem horário de verão desde 2019: UTC−3) → ISO. */
export function spToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO → { date, time } em São Paulo (para preencher o formulário). */
export function isoToSp(iso: string): { date: string; time: string } {
  const d = new Date(new Date(iso).getTime() - 3 * 3_600_000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

/** Erro da Graph API ao publicar, em português. */
export function publishErrorMessage(code: number | undefined, detail: string | undefined): string {
  if (code === 190) return "O acesso à Meta expirou. Reconecte em Configurações › Integrações e reagende.";
  if (code === 10 || (code !== undefined && code >= 200 && code < 300)) return "A conexão da Meta não tem permissão para publicar neste perfil. Inclua a permissão e reagende.";
  if (code === 4 || code === 17 || code === 32 || code === 613) return "A Meta limitou as chamadas agora. Reagende para daqui a alguns minutos.";
  if (code === 9 || code === 368) return "A Meta bloqueou temporariamente as publicações deste perfil ou o limite do dia acabou.";
  return detail ? `A Meta recusou a publicação: ${detail}`.slice(0, 480) : "A Meta recusou a publicação.";
}

/** Formato do cronograma (task_content.format) → formato da publicação. */
export function formatFromContent(f: string | null | undefined): PostFormat {
  if (f === "reels" || f === "video_curto" || f === "video_premium") return "reels";
  if (f === "stories") return "stories";
  return "feed";
}
