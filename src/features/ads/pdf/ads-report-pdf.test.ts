import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { sampleReportData } from "@/domain/ads/report";
import { renderAdsReportPdf } from "./ads-report-pdf";

describe("PDF do relatório de anúncios", () => {
  it("traz cliente, período, indicadores, campanhas, destaque e saldo", async () => {
    const buf = await renderAdsReportPdf(sampleReportData(), "18/11/2026 10:00");
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const c = await (await pdf.getPage(i)).getTextContent();
      text += c.items.map((x) => ("str" in x ? x.str : "")).join(" ") + "\n";
    }
    const flat = text.replace(/ /g, " ").replace(/\s+/g, " ");
    expect(pdf.numPages).toBe(1);
    expect(flat).toContain("Relatório de anúncios");
    expect(flat).toContain("Clínica Exemplo");
    expect(flat).toContain("09/11/2026 a 15/11/2026");
    expect(flat).toContain("R$ 1.400,00");
    expect(flat).toContain("Custo por lead");
    expect(flat).toContain("R$ 20,00");
    expect(flat).toContain("Cadastros Clareamento");
    expect(flat).toContain("42 leads");
    expect(flat).toContain("VIDEO_SORRISO_CR-12_V2");
    expect(flat).toContain("R$ 450,00");
    expect(flat).toContain("página 1 de 1");
  });
});
