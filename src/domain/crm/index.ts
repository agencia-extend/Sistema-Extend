// Regras puras do comercial (RF-CRM): origem, telefone, prazo de parada na etapa, painel e importação.

export const LEAD_SOURCES = ["anuncio", "whatsapp", "indicacao", "prospeccao", "organico", "site", "outro"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const SOURCE_LABEL: Record<LeadSource, string> = {
  anuncio: "Anúncio",
  whatsapp: "WhatsApp",
  indicacao: "Indicação",
  prospeccao: "Prospecção",
  organico: "Orgânico / redes",
  site: "Site",
  outro: "Outro",
};

export const STAGE_KINDS = ["aberta", "ganho", "perdido"] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export const ACTIVITY_KINDS = ["ligacao", "mensagem", "reuniao", "nota"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export const ACTIVITY_LABEL: Record<ActivityKind | "etapa" | "sistema", string> = {
  ligacao: "Ligação",
  mensagem: "Mensagem",
  reuniao: "Reunião",
  nota: "Anotação",
  etapa: "Mudança de etapa",
  sistema: "Sistema",
};

/** Mesmo cálculo do banco (private.normalize_phone): só dígitos e DDI 55 quando vier com DDD. */
export function normalizePhone(input: string | null | undefined): string | null {
  const d = String(input ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 15) return d;
  return null;
}

/** (51) 99999-0001 a partir de 5551999990001. */
export function formatPhone(p: string | null | undefined): string {
  if (!p) return "";
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${p}`;
}

export function normalizeEmail(input: string | null | undefined): string | null {
  const e = String(input ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}

/** Link para abrir conversa no WhatsApp (sem API: abre o app de quem clica). */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  return phone ? `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;
}

export type SlaState = { days: number; late: boolean };

/** Há quantos dias o lead está na etapa e se passou do prazo dela. */
export function slaState(stageChangedAt: string, slaDays: number | null, now: Date = new Date()): SlaState {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(stageChangedAt).getTime()) / 86_400_000));
  return { days, late: slaDays != null && days >= slaDays };
}

export type PanelLead = {
  stageId: string;
  source: LeadSource;
  valueCents: number | null;
  ownerId: string | null;
  createdAt: string;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
};
export type PanelStage = { id: string; name: string; kind: StageKind; position: number };

export type PanelRow = { key: string; label: string; leads: number; won: number; lost: number; open: number; wonCents: number; conversion: number | null };

const inRange = (iso: string | null, from: number, to: number) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from && t < to;
};

/**
 * Painel comercial do período: leads que entraram, ganhos e perdas no período (pela data em que
 * aconteceram), conversão = ganhos / (ganhos + perdidos) e quebras por origem e responsável.
 */
export function buildPanel(
  leads: PanelLead[],
  stages: PanelStage[],
  owners: Map<string, string>,
  period: { from: Date; to: Date },
) {
  const from = period.from.getTime();
  const to = period.to.getTime();
  const kind = new Map(stages.map((s) => [s.id, s.kind]));
  const entered = leads.filter((l) => inRange(l.createdAt, from, to));
  const won = leads.filter((l) => inRange(l.wonAt, from, to) && kind.get(l.stageId) === "ganho");
  const lost = leads.filter((l) => inRange(l.lostAt, from, to) && kind.get(l.stageId) === "perdido");
  const open = leads.filter((l) => kind.get(l.stageId) === "aberta");
  const sum = (xs: PanelLead[]) => xs.reduce((a, l) => a + (l.valueCents ?? 0), 0);
  const rate = (w: number, l: number) => (w + l ? w / (w + l) : null);

  const group = (keyOf: (l: PanelLead) => string, labelOf: (k: string) => string): PanelRow[] => {
    const keys = new Set([...entered, ...won, ...lost, ...open].map(keyOf));
    return [...keys]
      .map((k) => {
        const w = won.filter((l) => keyOf(l) === k);
        const lo = lost.filter((l) => keyOf(l) === k).length;
        return {
          key: k,
          label: labelOf(k),
          leads: entered.filter((l) => keyOf(l) === k).length,
          won: w.length,
          lost: lo,
          open: open.filter((l) => keyOf(l) === k).length,
          wonCents: sum(w),
          conversion: rate(w.length, lo),
        };
      })
      .sort((a, b) => b.leads - a.leads || b.won - a.won || a.label.localeCompare(b.label));
  };

  const reasons = new Map<string, number>();
  for (const l of lost) {
    const r = (l.lostReason ?? "Sem motivo").trim();
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }

  return {
    totals: {
      leads: entered.length,
      won: won.length,
      lost: lost.length,
      open: open.length,
      wonCents: sum(won),
      openCents: sum(open),
      conversion: rate(won.length, lost.length),
    },
    funnel: [...stages]
      .sort((a, b) => a.position - b.position)
      .filter((s) => s.kind === "aberta")
      .map((s) => {
        const xs = open.filter((l) => l.stageId === s.id);
        return { id: s.id, name: s.name, count: xs.length, cents: sum(xs) };
      }),
    bySource: group((l) => l.source, (k) => SOURCE_LABEL[k as LeadSource] ?? k),
    byOwner: group((l) => l.ownerId ?? "", (k) => (k ? (owners.get(k) ?? "Sem responsável") : "Sem responsável")),
    lostReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}

// --- Importação -------------------------------------------------------------------

export type LeadImportField = "name" | "company" | "phone" | "email" | "source" | "value" | "notes";
export const LEAD_IMPORT_FIELDS: [LeadImportField, string][] = [
  ["name", "Nome do contato"],
  ["company", "Empresa"],
  ["phone", "Telefone / WhatsApp"],
  ["email", "E-mail"],
  ["source", "Origem"],
  ["value", "Valor estimado (R$)"],
  ["notes", "Observações"],
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function guessLeadMapping(headers: string[]): Record<string, LeadImportField | ""> {
  const used = new Set<LeadImportField>();
  const rules: [LeadImportField, RegExp][] = [
    ["email", /e-?mail/],
    ["phone", /(fone|telefone|celular|whats|zap|contato tel)/],
    ["company", /(empresa|companhia|negocio|loja|razao)/],
    ["source", /(origem|fonte|canal)/],
    ["value", /(valor|ticket|orcamento)/],
    ["notes", /(obs|nota|coment)/],
    ["name", /(nome|contato|lead|cliente)/],
  ];
  const out: Record<string, LeadImportField | ""> = {};
  for (const h of headers) {
    const f = fold(h);
    const hit = rules.find(([k, re]) => !used.has(k) && re.test(f));
    out[h] = hit ? hit[0] : "";
    if (hit) used.add(hit[0]);
  }
  return out;
}

export function parseSource(value: unknown): LeadSource {
  const f = fold(String(value ?? ""));
  if (!f) return "outro";
  if (/(anunc|ads|meta|facebook|instagram ads|google ads|trafego)/.test(f)) return "anuncio";
  if (/(whats|zap)/.test(f)) return "whatsapp";
  if (/indica/.test(f)) return "indicacao";
  if (/prospec/.test(f)) return "prospeccao";
  if (/(organ|insta|rede|social)/.test(f)) return "organico";
  if (/(site|landing|formul)/.test(f)) return "site";
  return "outro";
}

export type LeadImportRow = { name: string; company: string; phone: string | null; email: string | null; source: LeadSource; value_cents: number | null; notes: string };

/** Monta as linhas da importação e marca as repetidas dentro da própria planilha. */
export function buildLeadRows(records: Record<string, unknown>[], mapping: Record<string, LeadImportField | "">) {
  const col = (r: Record<string, unknown>, f: LeadImportField) => {
    const h = Object.keys(mapping).find((k) => mapping[k] === f);
    return h ? String(r[h] ?? "").trim() : "";
  };
  const rows: LeadImportRow[] = [];
  const problems: { line: number; message: string }[] = [];
  const phones = new Set<string>();
  const emails = new Set<string>();
  records.forEach((r, i) => {
    const line = i + 2;
    const name = col(r, "name") || col(r, "company");
    if (name.length < 2) return void problems.push({ line, message: "sem nome" });
    const phone = normalizePhone(col(r, "phone"));
    const email = normalizeEmail(col(r, "email"));
    if ((phone && phones.has(phone)) || (email && emails.has(email))) return void problems.push({ line, message: "repetido na planilha" });
    if (phone) phones.add(phone);
    if (email) emails.add(email);
    const raw = col(r, "value").replace(/[^\d,.-]/g, "");
    const num = raw ? Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw) : NaN;
    rows.push({
      name: name.slice(0, 120),
      company: col(r, "company").slice(0, 160),
      phone,
      email,
      source: parseSource(col(r, "source")),
      value_cents: Number.isFinite(num) && num >= 0 ? Math.round(num * 100) : null,
      notes: col(r, "notes").slice(0, 4000),
    });
  });
  return { rows, problems };
}

// --- Período do painel (horário de Brasília, UTC-3 o ano todo) -------------------

export const PERIODS = { mes: "Este mês", anterior: "Mês passado", "90": "Últimos 90 dias", ano: "Este ano" } as const;
export type PeriodKey = keyof typeof PERIODS;

export function isPeriod(v: string | undefined): v is PeriodKey {
  return Boolean(v && v in PERIODS);
}

export function periodRange(key: PeriodKey, now: Date = new Date()): { from: Date; to: Date } {
  const sp = new Date(now.getTime() - 3 * 3600_000);
  const y = sp.getUTCFullYear();
  const m = sp.getUTCMonth();
  const at = (yy: number, mm: number, dd = 1) => new Date(Date.UTC(yy, mm, dd, 3));
  switch (key) {
    case "anterior":
      return { from: at(y, m - 1), to: at(y, m) };
    case "90":
      return { from: new Date(now.getTime() - 90 * 86_400_000), to: now };
    case "ano":
      return { from: at(y, 0), to: at(y + 1, 0) };
    default:
      return { from: at(y, m), to: at(y, m + 1) };
  }
}
