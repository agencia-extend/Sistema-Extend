// Propostas comerciais (RF-PRO-01 a 05): blocos do modelo, variáveis, totais e o documento
// que alimenta, do mesmo jeito, a prévia na tela, a página pública e o PDF.
import { formatBRL } from "@/domain/shared/money";

export const BLOCK_TYPES = ["capa", "sobre", "diagnostico", "servicos", "investimento", "condicoes", "prazos", "proximos_passos", "contato", "texto", "imagem"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABEL: Record<BlockType, string> = {
  capa: "Capa",
  sobre: "Sobre a Extend",
  diagnostico: "Diagnóstico",
  servicos: "Serviços",
  investimento: "Investimento",
  condicoes: "Condições",
  prazos: "Prazos",
  proximos_passos: "Próximos passos",
  contato: "Contato",
  texto: "Texto livre",
  imagem: "Imagem",
};

/** O que cada bloco mostra além do texto. */
export const BLOCK_HINT: Partial<Record<BlockType, string>> = {
  capa: "Logo, número, data e validade aparecem sozinhos.",
  servicos: "A lista dos serviços escolhidos, com a descrição de cada um, aparece abaixo do texto.",
  investimento: "A tabela de valores com descontos e totais aparece abaixo do texto.",
  imagem: "PNG ou JPG de até 5 MB. O texto vira a legenda.",
};

export type Block = { id: string; type: BlockType; title: string; body: string; imagePath?: string | null };

export const RECURRENCES = ["mensal", "unico"] as const;
export type Recurrence = (typeof RECURRENCES)[number];
export const RECURRENCE_LABEL: Record<Recurrence, string> = { mensal: "Mensal", unico: "Valor único" };

export type ProposalItem = {
  serviceId: string | null;
  name: string;
  description: string;
  priceCents: number;
  discountCents: number;
  quantity: number;
  recurrence: Recurrence;
};

export const PROPOSAL_STATUSES = ["rascunho", "enviada", "visualizada", "aceita", "recusada", "expirada"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export const STATUS_LABEL: Record<ProposalStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  visualizada: "Visualizada",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
};
export const STATUS_TONE: Record<ProposalStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  rascunho: "neutral",
  enviada: "info",
  visualizada: "warning",
  aceita: "success",
  recusada: "danger",
  expirada: "neutral",
};

export const PAYMENT_OPTIONS = ["Boleto mensal", "Pix mensal", "Cartão de crédito recorrente", "Transferência mensal"];

export const VARIABLES = [
  { key: "cliente", label: "Nome do cliente" },
  { key: "contato", label: "Pessoa de contato" },
  { key: "vendedor", label: "Quem enviou" },
  { key: "servicos", label: "Serviços escolhidos" },
  { key: "valor_mensal", label: "Total mensal" },
  { key: "valor_unico", label: "Total de valor único" },
  { key: "valor_total", label: "Resumo do investimento" },
  { key: "forma_pagamento", label: "Forma de pagamento" },
  { key: "validade", label: "Validade" },
  { key: "data", label: "Data da proposta" },
  { key: "numero", label: "Número da proposta" },
  { key: "observacoes", label: "Observações / diagnóstico" },
] as const;

/** Tudo o que a proposta exibe numa versão (gravado em proposal_versions.snapshot). */
export type ProposalSnapshot = {
  number: number;
  issuedAt: string; // AAAA-MM-DD
  templateName: string;
  templateVersion?: number;
  blocks: Block[];
  clientName: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  sellerName: string;
  items: ProposalItem[];
  paymentTerms: string;
  notes: string;
  validUntil: string; // AAAA-MM-DD
};

export function lineTotal(i: Pick<ProposalItem, "priceCents" | "quantity" | "discountCents">): number {
  return i.priceCents * i.quantity - i.discountCents;
}

export type Totals = { monthlyCents: number; oneTimeCents: number; grossCents: number; discountCents: number };

export function computeTotals(items: ProposalItem[]): Totals {
  const t: Totals = { monthlyCents: 0, oneTimeCents: 0, grossCents: 0, discountCents: 0 };
  for (const i of items) {
    t.grossCents += i.priceCents * i.quantity;
    t.discountCents += i.discountCents;
    if (i.recurrence === "mensal") t.monthlyCents += lineTotal(i);
    else t.oneTimeCents += lineTotal(i);
  }
  return t;
}

/** "R$ 2.500,00 por mês + R$ 1.500,00 (valor único)". */
export function totalSummary(t: Totals): string {
  const parts: string[] = [];
  if (t.monthlyCents > 0) parts.push(`${formatBRL(t.monthlyCents)} por mês`);
  if (t.oneTimeCents > 0) parts.push(`${formatBRL(t.oneTimeCents)} (valor único)`);
  return parts.join(" + ") || formatBRL(0);
}

/** AAAA-MM-DD → DD/MM/AAAA (datas sem hora, sem fuso). */
export function formatDay(day: string): string {
  const [y, m, d] = day.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : day;
}

/** Hoje + n dias em São Paulo, como AAAA-MM-DD. */
export function addDaysSP(days: number, now: Date = new Date()): string {
  const sp = new Date(now.getTime() - 3 * 3600_000);
  sp.setUTCDate(sp.getUTCDate() + days);
  return sp.toISOString().slice(0, 10);
}

export function todaySP(now: Date = new Date()): string {
  return addDaysSP(0, now);
}

/** Status considerando o vencimento (o job diário grava "expirada"; a tela já mostra antes). */
export function effectiveStatus(status: ProposalStatus, validUntil: string, now: Date = new Date()): ProposalStatus {
  if ((status === "enviada" || status === "visualizada") && validUntil < todaySP(now)) return "expirada";
  return status;
}

export function variablesFor(s: ProposalSnapshot): Record<string, string> {
  const t = computeTotals(s.items);
  return {
    cliente: s.clientName,
    contato: s.contactName || s.clientName,
    vendedor: s.sellerName,
    servicos: s.items.map((i) => i.name).join(", "),
    valor_mensal: formatBRL(t.monthlyCents),
    valor_unico: formatBRL(t.oneTimeCents),
    valor_total: totalSummary(t),
    forma_pagamento: s.paymentTerms || "a combinar",
    validade: formatDay(s.validUntil),
    data: formatDay(s.issuedAt),
    numero: String(s.number).padStart(4, "0"),
    observacoes: s.notes,
  };
}

/** Troca {variavel} pelo valor. Chaves desconhecidas ficam como estão (o editor avisa). */
export function fillVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-z_]+)\}/g, (all, key: string) => (key in vars ? vars[key] : all));
}

export function unknownVariables(text: string): string[] {
  const known = new Set<string>(VARIABLES.map((v) => v.key));
  known.add("link");
  return [...new Set([...text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).filter((k) => !known.has(k)))];
}

// Texto rico simples: parágrafos separados por linha em branco, "- " para lista e **negrito**.
export type Inline = { text: string; bold: boolean };
export type RichNode = { kind: "p"; lines: Inline[][] } | { kind: "ul"; items: Inline[][] };

export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    if (m.index! > last) out.push({ text: line.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false });
  return out;
}

export function parseRich(text: string): RichNode[] {
  const nodes: RichNode[] = [];
  for (const chunk of text.replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lines.length) continue;
    let para: Inline[][] = [];
    let list: Inline[][] = [];
    const flushPara = () => { if (para.length) nodes.push({ kind: "p", lines: para }); para = []; };
    const flushList = () => { if (list.length) nodes.push({ kind: "ul", items: list }); list = []; };
    for (const l of lines) {
      const bullet = /^\s*[-•]\s+(.*)$/.exec(l);
      if (bullet) { flushPara(); list.push(parseInline(bullet[1])); }
      else { flushList(); para.push(parseInline(l.trim())); }
    }
    flushPara();
    flushList();
  }
  return nodes;
}

export type DocSection = { id: string; type: BlockType; title: string; nodes: RichNode[]; imagePath: string | null };
export type DocLine = ProposalItem & { totalCents: number };
export type ProposalDoc = {
  number: string;
  issuedAt: string;
  validUntil: string;
  clientName: string;
  contactName: string;
  sellerName: string;
  paymentTerms: string;
  sections: DocSection[];
  lines: DocLine[];
  totals: Totals;
};

const ALWAYS_SHOWN: BlockType[] = ["capa", "servicos", "investimento", "imagem"];

export function buildDoc(s: ProposalSnapshot): ProposalDoc {
  const vars = variablesFor(s);
  const sections = s.blocks
    .map((b) => ({ id: b.id, type: b.type, title: fillVariables(b.title, vars), nodes: parseRich(fillVariables(b.body, vars)), imagePath: b.imagePath ?? null }))
    .filter((b) => ALWAYS_SHOWN.includes(b.type) ? (b.type !== "imagem" || Boolean(b.imagePath)) : b.nodes.length > 0);
  return {
    number: vars.numero,
    issuedAt: vars.data,
    validUntil: vars.validade,
    clientName: s.clientName,
    contactName: s.contactName,
    sellerName: s.sellerName,
    paymentTerms: s.paymentTerms,
    sections,
    lines: s.items.map((i) => ({ ...i, totalCents: lineTotal(i) })),
    totals: computeTotals(s.items),
  };
}

/** Texto plano do documento (usado nos testes para comparar prévia e PDF). */
export function docText(d: ProposalDoc): string {
  const inl = (xs: Inline[]) => xs.map((x) => x.text).join("");
  return d.sections
    .map((s) => [s.title, ...s.nodes.flatMap((n) => (n.kind === "p" ? n.lines.map(inl) : n.items.map(inl)))].join("\n"))
    .join("\n\n");
}

export function whatsappMessage(template: string, vars: Record<string, string>, link: string): string {
  return fillVariables(template, { ...vars, link });
}

export function newBlockId(): string {
  return Math.random().toString(36).slice(2, 10);
}
