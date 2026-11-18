// Fotos, áudios, vídeos e documentos do Atendimento (adaptado do HubSystem, src/domain/whatsapp/media.ts). Sem rede.

export type MediaKind = "image" | "video" | "audio" | "document" | "sticker";

const MB = 1024 * 1024;

const RULES: { test: RegExp; kind: MediaKind; maxBytes: number }[] = [
  { test: /^image\/(jpeg|png)$/, kind: "image", maxBytes: 5 * MB },
  { test: /^image\/webp$/, kind: "sticker", maxBytes: 1 * MB },
  { test: /^video\/(mp4|3gpp)$/, kind: "video", maxBytes: 16 * MB },
  { test: /^audio\/(ogg|mpeg|mp4|aac|amr|webm)$/, kind: "audio", maxBytes: 16 * MB },
  { test: /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.[\w.]+|text\/plain)$/, kind: "document", maxBytes: 50 * MB },
];

/** O navegador grava "audio/webm;codecs=opus": só o tipo interessa. */
export const baseMime = (mime: string) => mime.split(";")[0].trim().toLowerCase();

/** O que o seletor de arquivos oferece no envio. */
export const MEDIA_ACCEPT = "image/jpeg,image/png,video/mp4,audio/ogg,audio/mpeg,audio/mp4,audio/aac,.pdf,.doc,.docx,.xlsx,.pptx,.txt";

/** Valida o arquivo antes de enviar. */
export function checkOutgoingMedia(input: { mime: string; size: number }): { ok: true; kind: MediaKind } | { ok: false; message: string } {
  const mime = baseMime(input.mime);
  const rule = RULES.find((r) => r.test.test(mime));
  if (!rule) return { ok: false, message: "Este tipo de arquivo não pode ser enviado pelo WhatsApp. Use foto JPG ou PNG, vídeo MP4, áudio ou documento (PDF, Word, Excel, PowerPoint ou texto)." };
  if (input.size <= 0) return { ok: false, message: "O arquivo está vazio." };
  if (input.size > rule.maxBytes) return { ok: false, message: `O arquivo passa do limite de ${rule.maxBytes / MB} MB para este tipo. Envie um arquivo menor.` };
  return { ok: true, kind: rule.kind };
}

/** Como mostrar na conversa: foto e figurinha como imagem, áudio com player, vídeo com player, o resto como arquivo. */
export function mediaView(mime: string | null): "image" | "audio" | "video" | "file" {
  const m = baseMime(mime ?? "");
  if (/^image\/(jpeg|png|webp|gif)$/.test(m)) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (/^video\/(mp4|3gpp|webm)$/.test(m)) return "video";
  return "file";
}

/** Tipos que o sistema entrega para o navegador (o resto não é servido). */
export const SERVABLE_MIME = /^(image\/(jpeg|png|webp|gif)|audio\/(ogg|mpeg|mp4|aac|amr|webm)|video\/(mp4|3gpp|webm)|application\/pdf|application\/vnd\.openxmlformats-officedocument\.[\w.]+|application\/vnd\.ms-[\w.]+|application\/msword|text\/plain)$/;

/** Nome seguro para o download. */
export const safeFileName = (name: string | null) => (name ?? "arquivo").replace(/[^\w.\- À-ÿ]/g, "_").slice(0, 120) || "arquivo";

/** Extensão a partir do tipo, para o arquivo recebido sem nome. */
export function extensionOf(mime: string): string {
  const m = baseMime(mime);
  const map: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/webm": "webm", "video/mp4": "mp4", "application/pdf": "pdf" };
  return map[m] ?? "bin";
}

/** Caminho do arquivo enviado: por organização, sem nome vindo de quem usa. */
export const outgoingPath = (organizationId: string, id: string) => `${organizationId}/enviados/${id}`;
export const isOutgoingPath = (path: string, organizationId: string) => new RegExp(`^${organizationId}/enviados/[0-9a-f-]{36}$`, "i").test(path);

/** Caminho do arquivo recebido: o id da mensagem vira só letras, números e _. */
export const incomingPath = (organizationId: string, connectionId: string, wamid: string) => `${organizationId}/${connectionId}/${wamid.replace(/[^\w-]/g, "_").slice(0, 150)}`;
