// Eventos do WAHA no Atendimento (adaptado do HubSystem, src/domain/whatsapp/waha.ts). Sem rede.

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/**
 * O envio devolve o id cru (3EB0…) e o webhook, o composto (true_5548…@c.us_3EB0…); em grupo o composto ainda
 * termina com quem escreveu. Todos viram o id cru, para o eco do envio e as confirmações acharem a mesma mensagem.
 */
export function bareMessageId(id: string): string {
  const parts = id.split("_");
  return (parts.length >= 3 ? parts[2] : parts[parts.length - 1]).slice(0, 200);
}

/** Id da mensagem na resposta de envio (o formato varia por motor e versão). */
export function messageIdFromResponse(raw: unknown): string | null {
  const r = obj(raw);
  if (!r) return null;
  const inner = obj(r.id);
  const found = str(r.id) ?? str(inner?._serialized) ?? str(inner?.id) ?? str(obj(r.key)?.id);
  return found ? bareMessageId(found) : null;
}

export type Ack = "enviada" | "entregue" | "lida" | "erro";
const ACK: Record<string, Ack> = { "-1": "erro", "1": "enviada", "2": "entregue", "3": "lida", "4": "lida" };
/** Confirmação do WhatsApp: 1 enviada (✓), 2 entregue (✓✓), 3 e 4 lida/ouvida (✓✓ azul), -1 erro. */
export const ackStatus = (ack: unknown): Ack | null => ACK[String(ack)] ?? null;
const ORDER: Record<Ack, number> = { erro: 0, enviada: 1, entregue: 2, lida: 3 };
/** As confirmações podem chegar fora de ordem: só avança (lida não volta a entregue). */
export const ackAdvances = (current: Ack | null, next: Ack) => next === "erro" ? current === null || current === "enviada" : current === null || ORDER[next] > ORDER[current];

/** Telefone real de quem tem id oculto (@lid), quando o evento traz (remoteJidAlt / senderPn). */
export function altPhone(data: unknown): string | null {
  const d = obj(data);
  const key = obj(d?.key);
  for (const c of [str(key?.remoteJidAlt), str(key?.senderPn), str(d?.senderPn)]) {
    const m = c ? /^(\d{10,15})(?::\d+)?@(c\.us|s\.whatsapp\.net)$/.exec(c) : null;
    if (m) return m[1];
  }
  return null;
}

export type AdReferral = { sourceId: string | null; headline: string | null; url: string | null; ctwaClid: string | null };

const WRAPPERS = ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "documentWithCaptionMessage", "editedMessage"];

/** Anúncio Clique-para-WhatsApp: vem no contextInfo da primeira mensagem do contato. */
export function referralFromRaw(raw: unknown): AdReferral | null {
  let m = obj(raw);
  for (let i = 0; m && i < 4; i++) {
    const inner = WRAPPERS.map((k) => obj(obj(m![k])?.message)).find(Boolean);
    if (!inner) break;
    m = inner;
  }
  if (!m) return null;
  const candidates = [obj(m.extendedTextMessage)?.contextInfo, obj(m.imageMessage)?.contextInfo, obj(m.videoMessage)?.contextInfo, m.contextInfo];
  const ad = candidates.map(obj).map((c) => obj(c?.externalAdReply) ?? obj(c?.externalAdReplyInfo)).find(Boolean);
  if (!ad) return null;
  const sourceId = str(ad.sourceId) ?? str(ad.source_id);
  const ctwaClid = str(ad.ctwaClid) ?? str(ad.ctwa_clid);
  if (!sourceId && !ctwaClid) return null;
  const url = str(ad.sourceUrl);
  return { sourceId: sourceId?.slice(0, 64) ?? null, headline: str(ad.title)?.slice(0, 300) ?? null, url: url && url.startsWith("https://") ? url.slice(0, 1000) : null, ctwaClid: ctwaClid?.slice(0, 300) ?? null };
}
