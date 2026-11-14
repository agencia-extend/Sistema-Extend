/** Privacidade (LGPD): versão da política, tipos de pedido e prazos. */

/** Mude a data quando o texto da política ou dos termos mudar: todos verão o aviso de novo. */
export const PRIVACY_VERSION = "2026-11-13";
export const PRIVACY_UPDATED_LABEL = "13/11/2026";

export const REQUEST_KINDS = ["acesso", "correcao", "exclusao", "portabilidade", "revogacao", "oposicao", "informacao"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

/** O que a pessoa quer, em palavras dela (art. 18 da LGPD). */
export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  acesso: "Ver quais dados vocês têm sobre mim",
  correcao: "Corrigir um dado errado ou desatualizado",
  exclusao: "Apagar dados que não precisam mais ser guardados",
  portabilidade: "Receber meus dados para levar a outro lugar",
  revogacao: "Retirar um consentimento que dei",
  oposicao: "Me opor a um uso dos meus dados",
  informacao: "Saber com quem meus dados são compartilhados",
};

export const REQUEST_KIND_SHORT: Record<RequestKind, string> = {
  acesso: "Acesso",
  correcao: "Correção",
  exclusao: "Exclusão",
  portabilidade: "Portabilidade",
  revogacao: "Retirar consentimento",
  oposicao: "Oposição",
  informacao: "Compartilhamento",
};

export const REQUEST_STATUSES = ["aberto", "em_andamento", "concluido", "recusado"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Atendido",
  recusado: "Respondido com recusa",
};

export function isOpen(status: RequestStatus) {
  return status === "aberto" || status === "em_andamento";
}

/** Situação do prazo legal (15 dias) de um pedido ainda aberto. */
export function deadlineState(dueOn: string, status: RequestStatus, today: string): "fechado" | "atrasado" | "vence_logo" | "no_prazo" {
  if (!isOpen(status)) return "fechado";
  if (dueOn < today) return "atrasado";
  const days = (Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return days <= 3 ? "vence_logo" : "no_prazo";
}

/** CNPJ com máscara 00.000.000/0000-00 e dígitos verificadores corretos. */
export function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function isValidCnpj(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}
