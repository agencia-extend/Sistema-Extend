// "Compilar conversas" (como no HubSystem): o que vem do WAHA vira linha do banco. Sem rede.

export type ChatKind = "contato" | "grupo" | "ignorar";

/** Estados, listas de transmissão e canais ficam de fora. */
export function chatKind(jid: string): ChatKind {
  if (/^[0-9-]+@g\.us$/.test(jid)) return "grupo";
  if (/^[0-9]+@(c\.us|s\.whatsapp\.net|lid)$/.test(jid)) return "contato";
  return "ignorar";
}

/** Telefone (só dígitos) de um endereço do WhatsApp. Id oculto (@lid) e grupo não têm telefone. */
export function phoneOfJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const m = /^(\d{10,15})(?::\d+)?@(c\.us|s\.whatsapp\.net)$/.exec(jid);
  return m ? m[1] : null;
}

/** Nome que parece telefone não serve como nome do contato. */
export const looksLikePhone = (name: string) => /^\+?[\d\s()-]+$/.test(name.trim());

export type HistoryMessage = {
  wamid: string;
  from_me: boolean;
  author: string | null;
  author_name: string | null;
  body: string | null;
  kind: "text" | "media";
  sent_at: string;
};

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

/**
 * Mensagem do histórico (GET /api/{sessão}/chats/{id}/messages) pronta para gravar. A mídia antiga não é baixada:
 * fica o aviso e a legenda. Mensagem de sistema (sem texto e sem mídia) devolve null.
 * `alt` é o telefone real de quem tem id oculto (@lid); `pushName`, o nome que a pessoa usa no WhatsApp.
 */
export function historyMessage(raw: unknown, group: boolean): (HistoryMessage & { alt: string | null; pushName: string | null }) | null {
  const m = obj(raw);
  const id = str(m?.id) ?? str(obj(m?.id)?._serialized);
  const at = typeof m?.timestamp === "number" && m.timestamp > 0 ? m.timestamp : null;
  if (!m || !id || !at) return null;
  const data = obj(m._data);
  const key = obj(data?.key);
  const body = str(m.body);
  const media = m.hasMedia === true;
  if (!body && !media) return null;
  const fromMe = m.fromMe === true;
  const pushName = fromMe ? null : str(data?.pushName) ?? str(data?.notifyName);
  return {
    wamid: id.slice(0, 200),
    from_me: fromMe,
    author: group && !fromMe ? (str(m.participant) ?? str(key?.participant)) : null,
    author_name: pushName ? pushName.slice(0, 200) : null,
    body: body ? body.slice(0, 8000) : null,
    kind: media ? "media" : "text",
    sent_at: new Date(at * 1000).toISOString(),
    alt: str(key?.remoteJidAlt) ?? str(key?.senderPn),
    pushName,
  };
}

/**
 * Endereço do servidor do WhatsApp aceito pelo sistema: https público. Endereço local (http://127.0.0.1, localhost)
 * só quando o próprio sistema roda na máquina (testes).
 */
export function validServerUrl(raw: string, allowLocal: boolean): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (local) return allowLocal && (url.protocol === "http:" || url.protocol === "https:") ? url.origin : null;
  if (url.protocol !== "https:") return null;
  // Nada de rede interna: o sistema não pode ser usado para sondar outros endereços.
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/.test(url.hostname) || url.hostname.endsWith(".internal") || url.hostname.endsWith(".local")) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/** Andamento da compilação para a tela. */
export type ImportJob = {
  id: string;
  status: "importando" | "aguardando" | "concluida" | "erro" | "cancelada";
  include_contacts: boolean;
  include_groups: boolean;
  pass: number;
  contacts_done: number;
  groups_done: number;
  skipped: number;
  messages_done: number;
  last_error: string | null;
};
export const isActiveImport = (job: Pick<ImportJob, "status"> | null | undefined) => job?.status === "importando" || job?.status === "aguardando";
