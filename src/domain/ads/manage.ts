// Ajustes das campanhas da Meta pelo sistema: textos do registro de alterações e erros da Meta em português.
import { formatBRL } from "@/domain/shared/money";

export type AdLevel = "campaign" | "adset" | "ad";
export const LEVEL_NAME: Record<AdLevel, string> = { campaign: "a campanha", adset: "o conjunto", ad: "o anúncio" };
const LEVEL_OF: Record<AdLevel, string> = { campaign: "da campanha", adset: "do conjunto", ad: "do anúncio" };

export type AdChange =
  | { kind: "status"; level: AdLevel; name: string; active: boolean }
  | { kind: "budget"; level: "campaign" | "adset"; name: string; fromCents: number | null; toCents: number }
  | { kind: "rename"; level: AdLevel; from: string; to: string }
  | { kind: "duplicate"; level: "campaign" | "adset"; name: string };

/** Categoria e texto do registro de alterações do cliente. */
export function changeEntry(c: AdChange): { category: "pausa" | "ativacao" | "orcamento" | "campanha"; what: string } {
  switch (c.kind) {
    case "status":
      return c.active
        ? { category: "ativacao", what: `Ativou ${LEVEL_NAME[c.level]} "${c.name}" pelo sistema.` }
        : { category: "pausa", what: `Pausou ${LEVEL_NAME[c.level]} "${c.name}" pelo sistema.` };
    case "budget":
      return {
        category: "orcamento",
        what: `Orçamento diário ${LEVEL_OF[c.level]} "${c.name}": ${c.fromCents === null ? "sem orçamento diário" : formatBRL(c.fromCents)} → ${formatBRL(c.toCents)}.`,
      };
    case "rename":
      return { category: "campanha", what: `Renomeou ${LEVEL_NAME[c.level]} "${c.from}" para "${c.to}".` };
    case "duplicate":
      return { category: "campanha", what: `Duplicou ${LEVEL_NAME[c.level]} "${c.name}" (a cópia nasce pausada).` };
  }
}

/** Erro da Meta ao alterar, em português. A mensagem da própria Meta (em pt_BR) entra quando explica o motivo. */
export function manageErrorMessage(code: number | undefined, subcode: number | undefined, userMessage: string | undefined): string {
  if (code === 190) return "A conexão com a Meta expirou ou foi revogada. Reconecte em Configurações › Integrações.";
  if (code === 10 || code === 200 || code === 294 || (code !== undefined && code >= 200 && code < 300))
    return "A conexão da Meta não tem permissão para alterar campanhas (ads_management). Inclua a permissão no login do app da Meta e reconecte.";
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80004) return "A Meta limitou as alterações por alguns minutos. Tente de novo mais tarde.";
  if (userMessage && userMessage.trim().length > 3) return `A Meta não aceitou: ${userMessage.trim().slice(0, 300)}`;
  return "A Meta não aceitou a alteração. Tente de novo; se continuar, faça pelo Gerenciador de Anúncios.";
}
