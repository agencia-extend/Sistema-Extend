// Atendimento da Extend (RF-WPP-03): abas, telefone e nome do contato. Sem rede.

export const INBOX_TABS = [
  { key: "abertas", label: "Abertas" },
  { key: "grupos", label: "Grupos" },
  { key: "aguardando", label: "Aguardando resposta" },
  { key: "minhas", label: "Minhas" },
  { key: "encerradas", label: "Encerradas" },
] as const;
export type InboxTab = (typeof INBOX_TABS)[number]["key"];
export const parseInboxTab = (v: string | undefined): InboxTab => (INBOX_TABS.some((t) => t.key === v) ? (v as InboxTab) : "abertas");

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

export const REPLY_MAX = 4096;
