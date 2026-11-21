// Leads das campanhas dos clientes (RF-T2-01): leitura da planilha (Central de leads da Meta ou CRM do cliente),
// avaliação de qualidade e resumo por campanha. Não confundir com o funil comercial da Extend (domain/crm).
import { normalizeEmail, normalizePhone } from "@/domain/crm";

export const LEAD_QUALITIES = ["bom", "medio", "ruim", "nao_atendeu"] as const;
export type LeadQuality = (typeof LEAD_QUALITIES)[number];
export const LEAD_QUALITY_LABEL: Record<LeadQuality, string> = { bom: "Bom", medio: "Médio", ruim: "Ruim", nao_atendeu: "Não atendeu" };
/** Qualificado = bom ou médio (ruim e "não atendeu" não contam). */
export const isQualified = (q: LeadQuality | null) => q === "bom" || q === "medio";

export type ClientLeadField = "id" | "date" | "name" | "phone" | "email" | "campaignId" | "campaign" | "ad" | "form";
export const CLIENT_LEAD_FIELDS: [ClientLeadField, string][] = [
  ["date", "Data do lead"],
  ["name", "Nome"],
  ["phone", "Telefone"],
  ["email", "E-mail"],
  ["campaign", "Campanha"],
  ["campaignId", "ID da campanha"],
  ["ad", "Anúncio"],
  ["form", "Formulário"],
  ["id", "ID do lead"],
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Cabeçalhos da exportação da Meta (em inglês) e os mais comuns em planilhas em português.
const GUESS: [RegExp, ClientLeadField][] = [
  [/^(id|lead id|id do lead)$/, "id"],
  [/^(created time|data|data do lead|data de criacao|criado em|date)/, "date"],
  [/^(full name|nome|nome completo|name)/, "name"],
  [/(phone|telefone|celular|whatsapp)/, "phone"],
  [/(e ?mail)/, "email"],
  [/^(campaign id|id da campanha)$/, "campaignId"],
  [/^(campaign name|campanha|nome da campanha)/, "campaign"],
  [/^(ad name|anuncio|nome do anuncio)/, "ad"],
  [/^(form name|formulario|nome do formulario)/, "form"],
];

export function guessClientLeadMapping(headers: string[]): Record<string, ClientLeadField | ""> {
  const used = new Set<ClientLeadField>();
  const out: Record<string, ClientLeadField | ""> = {};
  for (const h of headers) {
    const n = norm(h);
    const hit = GUESS.find(([re, f]) => !used.has(f) && re.test(n));
    out[h] = hit ? hit[1] : "";
    if (hit) used.add(hit[1]);
  }
  return out;
}

const BR_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/** Data do lead: Date (planilha), número de série do Excel, ISO (Meta) ou dd/mm/aaaa [hh:mm] (horário de São Paulo). */
export function parseLeadDate(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86_400_000) + 3 * 3600_000).toISOString();
  const s = String(v ?? "").trim();
  if (!s) return null;
  const br = BR_DATE.exec(s);
  if (br) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = br;
    const t = Date.UTC(+y, +m - 1, +d, +hh + 3, +mm, +ss);
    const back = new Date(t - 3 * 3600_000);
    return back.getUTCDate() === +d && back.getUTCMonth() === +m - 1 ? new Date(t).toISOString() : null;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const iso = s.length === 10 ? `${s}T00:00:00-03:00` : /([zZ]|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s.replace(" ", "T")}-03:00`;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  return null;
}

const text = (v: unknown, max: number) => {
  const s = String(v ?? "").trim().replace(/^[pf]:/i, ""); // a Meta prefixa "p:" (telefone) e "f:" (formulário)
  return s ? s.slice(0, max) : null;
};

export type ClientLeadRow = {
  external_key: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  lead_at: string;
  campaign_ext_id: string | null;
  campaign_name: string | null;
  ad_name: string | null;
  form_name: string | null;
};

/** Linhas válidas para gravar e as recusadas (com o número da linha na planilha e o motivo). */
export function buildClientLeadRows(records: Record<string, unknown>[], mapping: Record<string, ClientLeadField | "">) {
  const col = (f: ClientLeadField) => Object.keys(mapping).find((h) => mapping[h] === f);
  const get = (r: Record<string, unknown>, f: ClientLeadField) => {
    const h = col(f);
    return h ? r[h] : undefined;
  };
  const rows: ClientLeadRow[] = [];
  const skipped: { line: number; reason: string }[] = [];
  const seen = new Set<string>();
  records.forEach((r, i) => {
    const line = i + 2;
    const name = text(get(r, "name"), 200);
    const phone = normalizePhone(text(get(r, "phone"), 40));
    const email = normalizeEmail(text(get(r, "email"), 200));
    const leadAt = parseLeadDate(get(r, "date"));
    if (!name && !phone && !email) return skipped.push({ line, reason: "sem nome, telefone ou e-mail" });
    if (!leadAt) return skipped.push({ line, reason: "sem data do lead (use dd/mm/aaaa)" });
    const id = text(get(r, "id"), 120);
    const key = (id ? `id:${id}` : phone ? `tel:${phone}` : email ? `email:${email}` : `nome:${norm(name!)}:${leadAt.slice(0, 10)}`).slice(0, 200);
    if (seen.has(key)) return skipped.push({ line, reason: "repetido na planilha" });
    seen.add(key);
    rows.push({
      external_key: key,
      name,
      phone,
      email,
      lead_at: leadAt,
      campaign_ext_id: text(get(r, "campaignId"), 64),
      campaign_name: text(get(r, "campaign"), 300),
      ad_name: text(get(r, "ad"), 300),
      form_name: text(get(r, "form"), 300),
    });
  });
  return { rows, skipped };
}

export type QualityLead = { campaignId: string | null; campaignName: string | null; quality: LeadQuality | null };
export type QualityRow = {
  key: string;
  label: string;
  campaignId: string | null;
  leads: number;
  rated: number;
  counts: Record<LeadQuality, number>;
  qualified: number;
  /** Qualificados sobre avaliados. */
  pctQualified: number | null;
  spendCents: number | null;
  costPerQualifiedCents: number | null;
};

/** Resumo por campanha (e total): leads, avaliados, qualificados e custo por lead qualificado. */
export function summarizeQuality(leads: QualityLead[], spendByCampaign: Map<string, number>): { rows: QualityRow[]; total: QualityRow } {
  const blank = (key: string, label: string, campaignId: string | null): QualityRow => ({
    key, label, campaignId, leads: 0, rated: 0, counts: { bom: 0, medio: 0, ruim: 0, nao_atendeu: 0 }, qualified: 0, pctQualified: null, spendCents: null, costPerQualifiedCents: null,
  });
  const map = new Map<string, QualityRow>();
  const total = blank("total", "Total", null);
  for (const l of leads) {
    const key = l.campaignId ?? (l.campaignName ? `nome:${l.campaignName.trim().toLowerCase()}` : "sem");
    const row = map.get(key) ?? blank(key, l.campaignName?.trim() || "Sem campanha", l.campaignId);
    for (const r of [row, total]) {
      r.leads++;
      if (l.quality) {
        r.rated++;
        r.counts[l.quality]++;
        if (isQualified(l.quality)) r.qualified++;
      }
    }
    map.set(key, row);
  }
  let spendTotal = 0;
  let anySpend = false;
  for (const r of map.values()) {
    if (r.campaignId && spendByCampaign.has(r.campaignId)) {
      r.spendCents = spendByCampaign.get(r.campaignId)!;
      spendTotal += r.spendCents;
      anySpend = true;
    }
  }
  if (anySpend) total.spendCents = spendTotal;
  for (const r of [...map.values(), total]) {
    r.pctQualified = r.rated ? r.qualified / r.rated : null;
    r.costPerQualifiedCents = r.spendCents !== null && r.qualified ? Math.round(r.spendCents / r.qualified) : null;
  }
  const rows = [...map.values()].sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label));
  return { rows, total };
}

/** Texto do CSV: a Central de leads da Meta exporta em UTF-16 (com BOM); planilhas comuns vêm em UTF-8. */
export function decodeCsv(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
  const start = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0;
  return new TextDecoder("utf-8").decode(b.subarray(start));
}
