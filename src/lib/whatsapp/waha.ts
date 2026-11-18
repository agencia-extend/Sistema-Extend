import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// WAHA: WhatsApp por QR Code num servidor próprio (hoje a máquina local; depois a VPS). Não é a API oficial.
// Adaptado do HubSystem (src/lib/waha.ts), só com o que a Extend usa.
export type WahaConn = { url: string; key: string; session: string };

export class WahaError extends Error {
  status?: number;
  /** Começo da resposta do servidor (sem a chave), para reconhecer erros conhecidos. */
  detail?: string;
  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

const EVENTS = ["message.any", "session.status"];

// Túneis gratuitos mostram uma página de aviso sem este cabeçalho.
const tunnelHeaders = (url: string): Record<string, string> => (new URL(url).hostname.endsWith(".ngrok-free.dev") ? { "ngrok-skip-browser-warning": "1" } : {});

async function call<T>(conn: Pick<WahaConn, "url" | "key">, path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${conn.url}${path}`, {
      ...init,
      headers: { "X-Api-Key": conn.key, "Content-Type": "application/json", Accept: "application/json", ...tunnelHeaders(conn.url), ...(init?.headers ?? {}) },
      cache: "no-store",
      redirect: "error", // a chave nunca acompanha um redirecionamento
      signal: AbortSignal.timeout(init?.timeoutMs ?? 20000),
    });
  } catch {
    throw new WahaError("Não foi possível falar com o servidor do WhatsApp. Confira se ele está ligado e se o endereço está certo.");
  }
  if (res.status === 401 || res.status === 403) throw new WahaError("O servidor do WhatsApp recusou a chave. Confira a chave da API.", res.status);
  if (!res.ok) throw new WahaError(`O servidor do WhatsApp respondeu com erro (${res.status}).`, res.status, (await res.text().catch(() => "")).slice(0, 300));
  return (await res.json().catch(() => ({}))) as T;
}

/** Confere endereço e chave antes de salvar. */
export async function wahaPing(conn: Pick<WahaConn, "url" | "key">) {
  await call(conn, "/api/sessions", { timeoutMs: 10000 });
}

const sessionConfig = (webhookUrl: string, secret: string) => ({
  ignore: { status: true, groups: false, channels: true, broadcast: true },
  // Histórico completo: ao ler o QR Code, o servidor carrega as conversas e os grupos do aparelho.
  noweb: { store: { enabled: true, fullSync: true } },
  webhooks: [{ url: webhookUrl, events: EVENTS, hmac: { key: secret } }],
});

/** Cria a sessão ou, se já existir, atualiza o webhook e a inicia de novo. */
export async function wahaStartSession(conn: WahaConn, webhookUrl: string, secret: string) {
  const config = sessionConfig(webhookUrl, secret);
  try {
    await call(conn, "/api/sessions", { method: "POST", body: JSON.stringify({ name: conn.session, start: true, config }) });
  } catch (e) {
    if ((e as WahaError).status !== 422 && (e as WahaError).status !== 409) throw e;
    await call(conn, `/api/sessions/${conn.session}`, { method: "PUT", body: JSON.stringify({ config }) });
    await call(conn, `/api/sessions/${conn.session}/start`, { method: "POST" }).catch((err: WahaError) => {
      if (err.status !== 422) throw err; // já iniciada
    });
  }
}

export type WahaSession = { status: string; me: { id?: string; pushName?: string } | null; config?: { noweb?: { store?: { enabled?: boolean } } } | null };

export async function wahaSession(conn: WahaConn): Promise<WahaSession | null> {
  try {
    return await call<WahaSession>(conn, `/api/sessions/${conn.session}`);
  } catch (e) {
    if ((e as WahaError).status === 404) return null;
    throw e;
  }
}

/** QR em imagem base64, pronto para mostrar na tela. */
export async function wahaQr(conn: WahaConn) {
  const r = await call<{ mimetype?: string; data?: string }>(conn, `/api/${conn.session}/auth/qr?format=image`, { headers: { Accept: "application/json" } });
  return r.data ? `data:${r.mimetype ?? "image/png"};base64,${r.data}` : null;
}

/** Código de 8 letras que substitui o QR Code (digitado no celular). */
export async function wahaRequestCode(conn: WahaConn, phone: string) {
  const r = await call<{ code?: string }>(conn, `/api/${conn.session}/auth/request-code`, { method: "POST", body: JSON.stringify({ phoneNumber: phone }), timeoutMs: 15000 });
  return r.code ?? null;
}

/** Gera um QR novo: os códigos expiram e a sessão para depois de algumas tentativas. */
export async function wahaRestart(conn: WahaConn) {
  await call(conn, `/api/sessions/${conn.session}/restart`, { method: "POST" });
}

/** O histórico só fica guardado com o store ligado antes do QR Code. */
export const wahaStoreOn = (s: WahaSession | null) => s?.config?.noweb?.store?.enabled === true;

/** Sai do aparelho e sobe a sessão de novo com o histórico ligado, pronta para outro QR Code. */
export async function wahaRelink(conn: WahaConn, webhookUrl: string, secret: string) {
  await call(conn, `/api/sessions/${conn.session}/logout`, { method: "POST" }).catch((e: WahaError) => {
    if (e.status !== 404) throw e;
  });
  await wahaStartSession(conn, webhookUrl, secret);
}

export type WahaChat = { id: string; name?: string | null };

/** Conversas do aparelho, das mais recentes para as mais antigas. */
export async function wahaChatsOverview(conn: WahaConn, limit: number, offset: number) {
  const raw = await call<unknown>(conn, `/api/${conn.session}/chats/overview?limit=${limit}&offset=${offset}`, { timeoutMs: 20000 });
  return (Array.isArray(raw) ? raw : []).flatMap((c: { id?: unknown; name?: unknown }) => {
    const id = typeof c.id === "string" ? c.id : (c.id as { _serialized?: string } | undefined)?._serialized;
    return id ? [{ id, name: typeof c.name === "string" ? c.name : null }] : [];
  });
}

/** Mensagens de uma conversa, das mais recentes para as mais antigas, sem baixar mídia. */
export const wahaChatMessages = (conn: WahaConn, chatId: string, limit: number, offset: number) =>
  call<unknown[]>(conn, `/api/${conn.session}/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}&offset=${offset}&downloadMedia=false&sortBy=messageTimestamp&sortOrder=desc`, { timeoutMs: 20000 });

export async function wahaGroupName(conn: WahaConn, groupId: string) {
  const r = await call<{ subject?: string; name?: string }>(conn, `/api/${conn.session}/groups/${encodeURIComponent(groupId)}`, { timeoutMs: 8000 });
  return r.subject ?? r.name ?? null;
}

/** Telefone real de quem tem id oculto (@lid), quando o servidor já conhece. */
export async function wahaLidPhone(conn: WahaConn, lid: string) {
  const r = await call<{ pn?: string | null }>(conn, `/api/${conn.session}/lids/${encodeURIComponent(lid)}`, { timeoutMs: 8000 });
  return r.pn ?? null;
}

/** Sai do aparelho (o número desconecta) e apaga a sessão. */
export async function wahaLogout(conn: WahaConn) {
  await call(conn, `/api/sessions/${conn.session}/logout`, { method: "POST" }).catch(() => null);
  await call(conn, `/api/sessions/${conn.session}`, { method: "DELETE" }).catch(() => null);
}

/** Grupos de que o número participa. O WAHA devolve um objeto por id ou uma lista, conforme o motor. */
export async function wahaGroups(conn: WahaConn) {
  const raw = await call<unknown>(conn, `/api/${conn.session}/groups?exclude=participants`, { timeoutMs: 30000 });
  const list = Array.isArray(raw) ? raw : Object.values((raw ?? {}) as Record<string, unknown>);
  return (list as { id?: unknown; subject?: unknown; name?: unknown }[]).flatMap((g) => {
    const id = typeof g.id === "string" ? g.id : (g.id as { _serialized?: string } | undefined)?._serialized;
    return id && id.endsWith("@g.us") ? [{ id, name: String(g.subject ?? g.name ?? "").slice(0, 200) }] : [];
  });
}

export async function wahaSendText(conn: WahaConn, chatId: string, text: string) {
  return call<{ id?: unknown }>(conn, "/api/sendText", { method: "POST", body: JSON.stringify({ session: conn.session, chatId, text }) });
}

export type OutgoingMedia = { url: string; mime: string; name: string; caption?: string | null; kind: "image" | "video" | "audio" | "document" | "sticker" };

/** Envia foto, vídeo, áudio (vira mensagem de voz) ou documento. O WAHA baixa o arquivo pelo link assinado. */
export async function wahaSendMedia(conn: WahaConn, chatId: string, media: OutgoingMedia) {
  const file = { url: media.url, mimetype: media.mime, filename: media.name };
  const caption = media.caption ? { caption: media.caption } : {};
  const plan =
    media.kind === "image" ? { path: "/api/sendImage", body: { file, ...caption } }
    : media.kind === "video" ? { path: "/api/sendVideo", body: { file, convert: true, ...caption } }
    : media.kind === "audio" ? { path: "/api/sendVoice", body: { file, convert: true } }
    : { path: "/api/sendFile", body: { file, ...caption } };
  return call<{ id?: unknown }>(conn, plan.path, { method: "POST", body: JSON.stringify({ session: conn.session, chatId, ...plan.body }), timeoutMs: 45000 });
}

/**
 * Baixa a mídia recebida. O WAHA monta o link com o próprio endereço interno, então só o caminho é aproveitado:
 * a chave nunca vai para outro servidor.
 */
export async function wahaDownload(conn: Pick<WahaConn, "url" | "key">, mediaUrl: string, maxBytes = 50 * 1024 * 1024) {
  const path = new URL(mediaUrl, conn.url);
  let res: Response;
  try {
    res = await fetch(`${conn.url}${path.pathname}${path.search}`, { headers: { "X-Api-Key": conn.key, ...tunnelHeaders(conn.url) }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(40000) });
  } catch {
    throw new WahaError("Não foi possível baixar o arquivo do servidor do WhatsApp.");
  }
  if (!res.ok) throw new WahaError(`O servidor do WhatsApp não entregou o arquivo (${res.status}).`, res.status);
  const body = await res.arrayBuffer();
  if (body.byteLength > maxBytes) throw new WahaError("O arquivo é grande demais para guardar.");
  return body;
}

/** Id da mensagem na resposta de envio (o formato varia por motor). */
export function sentMessageId(raw: { id?: unknown } | null | undefined): string | null {
  const id = raw?.id as string | { _serialized?: string } | undefined;
  return (typeof id === "string" ? id : id?._serialized) || null;
}

/** Assinatura do webhook: HMAC-SHA512 do corpo bruto com o segredo da sessão. */
export function validWahaSignature(rawBody: string, header: string | null, secret: string) {
  if (!header || !secret) return false;
  const expected = Buffer.from(createHmac("sha512", secret).update(rawBody, "utf8").digest("hex"));
  const got = Buffer.from(header);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
