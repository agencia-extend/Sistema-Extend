import { CREATIVE_FORMAT_LABEL, LIBRARY_STATUS_LABEL, type CreativeFormat, type LibraryStatus } from ".";
import { costPerResult, creativeKpis, creativeResults, type CreativeTotals } from "./performance";

export type ExportRow = {
  clientName: string;
  campaign: string;
  format: CreativeFormat;
  angle: string;
  status: LibraryStatus;
  primaryText: string | null;
  headline: string | null;
  approvedAt: string;
  link: string;
  /** Números do período (RF-BIB-05), só para quem vê a performance; sem anúncio ligado fica vazio. */
  totals?: CreativeTotals | null;
};

const money = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));
const pctCell = (v: number | null) => (v === null ? "" : (v * 100).toFixed(2).replace(".", ","));

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** CSV com ponto e vírgula (abre direto no Excel em português). */
export function libraryCsv(rows: ExportRow[], withNumbers = false): string {
  const head = ["Cliente", "Campanha", "Formato", "Ângulo", "Situação", "Texto principal", "Título", "Aprovado em", "Link",
    ...(withNumbers ? ["Investimento (R$)", "Impressões", "CTR (%)", "Resultados", "Custo por resultado (R$)", "Hook rate (%)", "ROAS"] : [])];
  const lines = rows.map((r) => {
    const t = r.totals;
    const k = t ? creativeKpis(t) : null;
    const numbers = !withNumbers ? [] : t && k
      ? [money(t.spendCents), String(t.impressions), pctCell(k.ctr), String(creativeResults(t)), money(costPerResult(t)), pctCell(k.hookRate), k.roas === null ? "" : k.roas.toFixed(2).replace(".", ",")]
      : ["", "", "", "", "", "", ""];
    return [r.clientName, r.campaign, CREATIVE_FORMAT_LABEL[r.format], r.angle, LIBRARY_STATUS_LABEL[r.status], r.primaryText ?? "", r.headline ?? "", r.approvedAt.slice(0, 10).split("-").reverse().join("/"), r.link, ...numbers]
      .map(cell)
      .join(";");
  });
  return "﻿" + [head.map(cell).join(";"), ...lines].join("\r\n");
}

/** Texto seguro para as fontes padrão do PDF (Latin-1): troca o que não cabe por "?" e tira quebras. */
export function pdfSafe(v: string): string {
  return v
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}
