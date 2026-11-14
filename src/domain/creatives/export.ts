import { CREATIVE_FORMAT_LABEL, LIBRARY_STATUS_LABEL, type CreativeFormat, type LibraryStatus } from ".";

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
};

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** CSV com ponto e vírgula (abre direto no Excel em português). */
export function libraryCsv(rows: ExportRow[]): string {
  const head = ["Cliente", "Campanha", "Formato", "Ângulo", "Situação", "Texto principal", "Título", "Aprovado em", "Link"];
  const lines = rows.map((r) =>
    [r.clientName, r.campaign, CREATIVE_FORMAT_LABEL[r.format], r.angle, LIBRARY_STATUS_LABEL[r.status], r.primaryText ?? "", r.headline ?? "", r.approvedAt.slice(0, 10).split("-").reverse().join("/"), r.link]
      .map(cell)
      .join(";"),
  );
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
