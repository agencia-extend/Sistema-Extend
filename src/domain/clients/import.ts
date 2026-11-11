// Importação da planilha "Controle de clientes": mapeamento de colunas e normalização.

export type ImportField = "name" | "segment" | "document" | "contract_start" | "contract_end" | "notes" | `service:${string}`;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const GUESS: [RegExp, ImportField][] = [
  [/^(cliente|nome|empresa|razao social)/, "name"],
  [/(nicho|segmento|ramo)/, "segment"],
  [/(cnpj|cpf|documento)/, "document"],
  [/(inicio|comeco|entrada)/, "contract_start"],
  [/(fim|termino|final|vencimento)/, "contract_end"],
  [/(obs|observ|nota)/, "notes"],
];

/** Sugere o campo de cada coluna pelo cabeçalho. Serviços: casa pelo nome do serviço ou palavra-chave. */
export function guessMapping(headers: string[], services: { id: string; name: string; key: string }[]): Record<string, ImportField | ""> {
  const used = new Set<string>();
  const out: Record<string, ImportField | ""> = {};
  for (const h of headers) {
    const n = norm(h);
    let field: ImportField | "" = "";
    for (const [re, f] of GUESS) {
      if (re.test(n) && !used.has(f)) {
        field = f;
        break;
      }
    }
    if (!field) {
      const svc = services.find((s) => {
        const sn = norm(s.name);
        return n.includes(sn) || (s.key === "pacote_videos" && /video/.test(n)) || (s.key === "conteudo_mensal" && /(design|arte|conteudo)/.test(n))
          || (s.key === "gerenciamento" && /gerenc/.test(n)) || (s.key === "meta_ads" && /(meta|facebook|instagram ads|trafego)/.test(n))
          || (s.key === "google_ads" && /google/.test(n));
      });
      if (svc) field = `service:${svc.id}`;
    }
    if (field) used.add(field);
    out[h] = field;
  }
  return out;
}

/** "10/11/2026", "2026-11-10", "10-11-26" → "2026-11-10". Inválida → null. */
export function parseDateBR(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Quantidade de um serviço numa célula: "4", "sim" (=1 sem quantidade), "x", "" → null. */
export function parseServiceCell(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (!s || ["nao", "não", "n", "0", "-", "—"].includes(s)) return null;
  const n = s.match(/\d+/);
  if (n) return Math.min(200, Number(n[0]));
  return ["sim", "s", "x", "ok", "yes", "✓"].includes(s) ? 0 : null;
}

export type ImportRow = {
  name: string;
  segment?: string;
  document?: string;
  contract_start?: string | null;
  contract_end?: string | null;
  notes?: string;
  services: { service_id: string; monthly_qty: number }[];
};

export type RowProblem = { line: number; message: string };

/** Aplica o mapeamento às linhas e aponta os problemas (linha da planilha, contando o cabeçalho). */
export function buildRows(records: Record<string, unknown>[], mapping: Record<string, ImportField | "">) {
  const rows: ImportRow[] = [];
  const problems: RowProblem[] = [];
  records.forEach((rec, i) => {
    const line = i + 2;
    const row: ImportRow = { name: "", services: [] };
    for (const [col, field] of Object.entries(mapping)) {
      if (!field) continue;
      const v = rec[col];
      if (field.startsWith("service:")) {
        const qty = parseServiceCell(v);
        if (qty !== null) row.services.push({ service_id: field.slice(8), monthly_qty: qty });
      } else if (field === "contract_start" || field === "contract_end") {
        const d = parseDateBR(v);
        if (v != null && String(v).trim() && !d) problems.push({ line, message: `Data inválida em “${col}”: ${String(v)}` });
        row[field] = d;
      } else {
        (row as Record<string, unknown>)[field] = v == null ? "" : String(v).trim().slice(0, field === "notes" ? 4000 : 160);
      }
    }
    if (!row.name || row.name.length < 2) {
      if (Object.values(rec).some((v) => v != null && String(v).trim())) problems.push({ line, message: "Sem nome do cliente" });
      return;
    }
    if (row.contract_start && row.contract_end && row.contract_end < row.contract_start) {
      problems.push({ line, message: "Fim do contrato antes do início" });
    }
    rows.push(row);
  });
  return { rows, problems };
}
