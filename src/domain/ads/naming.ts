// Nomenclatura padrão (RF-PLA-03): o padrão é um texto com peças entre chaves, ex.: {CLIENTE}_{OBJETIVO}_{PUBLICO}_{AAAA-MM}.
// Daqui saem o verificador (expressão regular e a primeira peça que não bate) e o gerador de nome. Sem rede.

export type NamingLevel = "campaign" | "adset" | "ad";
export const LEVEL_LABEL: Record<NamingLevel, string> = { campaign: "Campanha", adset: "Conjunto", ad: "Anúncio" };

export const OBJECTIVES = ["LEADS", "MENSAGENS", "VENDAS", "TRAFEGO", "ENGAJAMENTO", "ALCANCE", "RECONHECIMENTO", "SEGUIDORES", "VIDEO"] as const;
export const FORMATS = ["VIDEO", "IMAGEM", "CARROSSEL", "REELS", "STORIES"] as const;

type TokenDef = { label: string; hint: string; regex: string; options?: readonly string[]; example: string };
const WORDS = "[A-Z0-9]+(?:-[A-Z0-9]+)*";
export const TOKENS: Record<string, TokenDef> = {
  CLIENTE: { label: "Cliente (sigla)", hint: "2 a 12 letras ou números, ex.: GWP", regex: "[A-Z0-9]{2,12}", example: "GWP" },
  OBJETIVO: { label: "Objetivo", hint: OBJECTIVES.join(", "), regex: `(?:${OBJECTIVES.join("|")})`, options: OBJECTIVES, example: "LEADS" },
  PUBLICO: { label: "Público", hint: "palavras com hífen, ex.: INTERESSE-IMOVEIS", regex: WORDS, example: "FRIO" },
  POSICIONAMENTO: { label: "Posicionamento", hint: "ex.: FEED-STORIES", regex: WORDS, example: "FEED-STORIES" },
  IDADE: { label: "Idade", hint: "ex.: 25-55", regex: "\\d{2}-\\d{2}", example: "25-55" },
  "AAAA-MM": { label: "Mês", hint: "ex.: 2026-11", regex: "\\d{4}-(?:0[1-9]|1[0-2])", example: "2026-11" },
  FORMATO: { label: "Formato", hint: FORMATS.join(", "), regex: `(?:${FORMATS.join("|")})`, options: FORMATS, example: "VIDEO" },
  ANGULO: { label: "Ângulo", hint: "palavras com hífen, ex.: DOR-ALUGUEL", regex: WORDS, example: "DOR-ALUGUEL" },
  "V#": { label: "Versão", hint: "V1, V2…", regex: "V\\d{1,3}", example: "V2" },
  CR: { label: "Código do criativo", hint: "CR-42 (liga o anúncio ao criativo da biblioteca)", regex: "CR-\\d+", example: "CR-42" },
};

export const DEFAULT_NAMING: Record<NamingLevel, string> = {
  campaign: "{CLIENTE}_{OBJETIVO}_{PUBLICO}_{AAAA-MM}",
  adset: "{PUBLICO}_{POSICIONAMENTO}_{IDADE}",
  ad: "{FORMATO}_{ANGULO}_{V#}",
};

export type NamingPart = { kind: "token"; key: string } | { kind: "text"; value: string };

/** Separa o padrão em peças e textos fixos. Devolve o erro em português se houver peça desconhecida. */
export function parseNaming(template: string): { parts: NamingPart[] } | { error: string } {
  const t = template.trim();
  if (!t) return { error: "Escreva o padrão." };
  if (t.length > 120) return { error: "Padrão de até 120 caracteres." };
  const parts: NamingPart[] = [];
  const re = /\{([^{}]*)\}/g;
  let last = 0;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    if (m.index > last) parts.push({ kind: "text", value: t.slice(last, m.index) });
    if (!TOKENS[m[1]]) return { error: `Peça desconhecida: {${m[1]}}. Use as peças dos botões.` };
    parts.push({ kind: "token", key: m[1] });
    last = m.index + m[0].length;
  }
  if (last < t.length) parts.push({ kind: "text", value: t.slice(last) });
  if (/[{}]/.test(parts.filter((p) => p.kind === "text").map((p) => (p as { value: string }).value).join(""))) return { error: "Chave sem par: confira { e }." };
  if (!parts.some((p) => p.kind === "token")) return { error: "Use pelo menos uma peça, ex.: {CLIENTE}." };
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].kind === "token" && parts[i - 1].kind === "token") return { error: "Separe as peças com _ ou - (ex.: {CLIENTE}_{OBJETIVO})." };
  }
  return { parts };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const partRegex = (p: NamingPart) => (p.kind === "text" ? esc(p.value) : TOKENS[p.key].regex);

/** O nome segue o padrão? Se não, diz a primeira peça que não bate. */
export function checkName(name: string, parts: NamingPart[]): { ok: true } | { ok: false; reason: string } {
  const n = name.trim();
  if (new RegExp(`^${parts.map(partRegex).join("")}$`).test(n)) return { ok: true };
  for (let i = 0; i < parts.length; i++) {
    if (!new RegExp(`^${parts.slice(0, i + 1).map(partRegex).join("")}`).test(n)) {
      const p = parts[i];
      return { ok: false, reason: p.kind === "text" ? `falta o separador "${p.value}" depois de ${describe(parts[i - 1])}` : `${TOKENS[p.key].label.toLowerCase()} fora do padrão (${TOKENS[p.key].hint})` };
    }
  }
  return { ok: false, reason: "sobra texto no fim do nome" };
}

const describe = (p: NamingPart | undefined) => (!p ? "o começo" : p.kind === "token" ? TOKENS[p.key].label.toLowerCase() : `"${p.value}"`);

/** Texto livre vira peça do nome: maiúsculas, sem acento, espaços viram hífen. */
export function normalizePiece(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Monta o nome a partir dos valores das peças (normalizados). */
export function buildName(parts: NamingPart[], values: Record<string, string>): string {
  return parts.map((p) => {
    if (p.kind === "text") return p.value;
    const raw = values[p.key] ?? "";
    if (p.key === "V#") return /^\d+$/.test(raw.trim()) ? `V${raw.trim()}` : normalizePiece(raw);
    if (p.key === "CR") return /^\d+$/.test(raw.trim()) ? `CR-${raw.trim()}` : normalizePiece(raw).replace(/^CR(\d)/, "CR-$1");
    return normalizePiece(raw);
  }).join("");
}

/** Exemplo do padrão com os valores de exemplo de cada peça. */
export const exampleName = (parts: NamingPart[]) => parts.map((p) => (p.kind === "text" ? p.value : TOKENS[p.key].example)).join("");
