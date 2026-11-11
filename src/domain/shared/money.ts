// Dinheiro é sempre inteiro em centavos. Nunca somar floats de reais.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number | bigint | null | undefined): string {
  if (cents == null) return "—";
  return brl.format(Number(cents) / 100);
}

/**
 * Converte texto digitado ("1.234,56", "R$ 10", "10,5") em centavos.
 * Retorna null se vazio ou inválido.
 */
export function parseBRL(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  const s = input.replace(/\s|R\$/g, "").trim();
  if (!s) return null;
  if (!/^-?[\d.]*(,\d{0,2})?$/.test(s) && !/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const normalized = /^-?\d+\.\d{1,2}$/.test(s) ? s : s.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** Centavos → texto editável ("1.234,56"). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
