// Atendimento da Extend (RF-WPP-03/07): abas, filtros, telefone, nome do contato e datas da conversa. Sem rede.

export const INBOX_TABS = [
  { key: "abertas", label: "Abertas" },
  { key: "aguardando", label: "Aguardando" },
  { key: "radar", label: "Radar" },
  { key: "minhas", label: "Minhas" },
  { key: "grupos", label: "Grupos" },
  { key: "encerradas", label: "Encerradas" },
  { key: "apagadas", label: "Apagadas" },
] as const;
export type InboxTab = (typeof INBOX_TABS)[number]["key"];
export const parseInboxTab = (v: string | undefined): InboxTab => (INBOX_TABS.some((t) => t.key === v) ? (v as InboxTab) : "abertas");

export type InboxFilters = { tab: InboxTab; q?: string; assignee?: string; tag?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Filtros da URL (?aba, ?q, ?responsavel, ?etiqueta), já limpos. "ninguem" = sem responsável. */
export function parseInboxFilters(sp: Record<string, string | string[] | undefined>): InboxFilters {
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const q = one(sp.q)?.replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const assignee = one(sp.responsavel);
  const tag = one(sp.etiqueta);
  return {
    tab: parseInboxTab(one(sp.aba)),
    q: q || undefined,
    assignee: assignee === "ninguem" || (assignee && UUID.test(assignee)) ? assignee : undefined,
    tag: tag && UUID.test(tag) ? tag : undefined,
  };
}

/** Endereço da tela com os filtros atuais trocados por `patch` (undefined tira o filtro). */
export function inboxHref(current: Record<string, string | undefined>, patch: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/atendimento?${s}` : "/atendimento";
}

/** 5511999998888 → +55 (11) 99999-8888; outros países ficam com + e os dígitos. */
export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return "";
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${digits}`;
}

/** Nome para mostrar: o do lead, o do WhatsApp ou o telefone; grupo, o nome do grupo. */
export function contactLabel(c: { contactName: string; phone: string | null; leadName?: string | null; kind?: "contato" | "grupo" }): string {
  if (c.kind === "grupo") return c.contactName || "Grupo sem nome";
  return c.leadName || c.contactName || formatPhone(c.phone) || "Contato sem número";
}

/** Iniciais para a foto que falta (até 2 letras). */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const spDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Hora na lista: hoje "14:05", ontem "Ontem", na semana o dia, antes "12/11/2026". */
export function listTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = spDay(d);
  if (day === spDay(now)) return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  if (day === spDay(new Date(now.getTime() - 86_400_000))) return "Ontem";
  if (now.getTime() - d.getTime() < 6 * 86_400_000) {
    const w = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).split("-")[0];
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Separador de dia na conversa: "Hoje", "Ontem" ou "12 de novembro de 2026". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const day = spDay(new Date(iso));
  if (day === spDay(now)) return "Hoje";
  if (day === spDay(new Date(now.getTime() - 86_400_000))) return "Ontem";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" });
}

export const dayKey = (iso: string) => spDay(new Date(iso));
export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Quanto tempo o contato espera: "8 min", "2 h 5 min", "3 dias". */
export function waitingFor(sinceIso: string, now: Date = new Date()): string {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(sinceIso).getTime()) / 60_000));
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
  const d = Math.floor(min / (24 * 60));
  return `${d} ${d === 1 ? "dia" : "dias"}`;
}

export const TAG_COLORS = ["azul", "verde", "amarelo", "vermelho", "roxo", "cinza"] as const;
export type TagColor = (typeof TAG_COLORS)[number];
export const TAG_COLOR_LABEL: Record<TagColor, string> = { azul: "Azul", verde: "Verde", amarelo: "Amarelo", vermelho: "Vermelho", roxo: "Roxo", cinza: "Cinza" };

/** Respostas rápidas: "/atalho" no começo da caixa, sem espaço depois da barra. */
export function shortcutQuery(text: string): string | null {
  const m = /^\/([a-z0-9_-]*)$/i.exec(text);
  return m ? m[1].toLowerCase() : null;
}
export const matchQuickReplies = <T extends { shortcut: string }>(replies: T[], query: string) => replies.filter((r) => r.shortcut.startsWith(query)).slice(0, 8);

/** {nome} vira o primeiro nome do contato. */
export const fillQuickReply = (body: string, name: string | null | undefined) => body.replace(/\{nome\}/gi, (name ?? "").trim().split(/\s+/)[0] ?? "");

export const REPLY_MAX = 4096;
