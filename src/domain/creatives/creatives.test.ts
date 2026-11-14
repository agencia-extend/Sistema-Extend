import { describe, expect, it } from "vitest";
import { assetPreview, drivePreview, linkState, reviewActions, whatsappApprovalLink } from ".";
import { libraryCsv, pdfSafe } from "./export";

describe("criativos", () => {
  it("ações de revisão por etapa", () => {
    expect(reviewActions("Em revisão")).toEqual(["ajustes", "cliente", "aprovado"]);
    expect(reviewActions("Aprovação do cliente")).toEqual(["ajustes", "aprovado"]);
    expect(reviewActions("Aprovado")).toEqual(["entregue", "no_ar"]);
    expect(reviewActions("Em produção")).toEqual([]);
  });

  it("situação do link do cliente", () => {
    const now = new Date("2026-11-14T12:00:00Z");
    expect(linkState({ decidedAt: null, revokedAt: null, expiresAt: "2026-11-20T00:00:00Z" }, now)).toBe("aberto");
    expect(linkState({ decidedAt: "2026-11-14T10:00:00Z", revokedAt: null, expiresAt: "2026-11-20T00:00:00Z" }, now)).toBe("usado");
    expect(linkState({ decidedAt: null, revokedAt: "2026-11-14T10:00:00Z", expiresAt: "2026-11-20T00:00:00Z" }, now)).toBe("substituido");
    expect(linkState({ decidedAt: null, revokedAt: null, expiresAt: "2026-11-13T00:00:00Z" }, now)).toBe("expirado");
  });

  it("prévia de arquivos e Drive", () => {
    expect(assetPreview("image/png", null)).toBe("imagem");
    expect(assetPreview("video/mp4", null)).toBe("video");
    expect(assetPreview(null, "https://drive.google.com/file/d/abc_123/view")).toBe("drive");
    expect(drivePreview("https://drive.google.com/file/d/abc_123/view?usp=sharing")).toBe("https://drive.google.com/file/d/abc_123/preview");
    expect(assetPreview(null, "https://exemplo.com/x")).toBe("arquivo");
  });

  it("mensagem pronta do WhatsApp", () => {
    const l = whatsappApprovalLink("https://hub.agenciaextend.com.br/aprovar/abc", "Imobiliária", "Dor do aluguel");
    expect(l.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(l)).toContain("https://hub.agenciaextend.com.br/aprovar/abc");
  });
});


describe("exportação da biblioteca", () => {
  it("CSV com ponto e vírgula, aspas e data brasileira", () => {
    const csv = libraryCsv([
      { clientName: "Imobiliária", campaign: "Lançamento", format: "video", angle: 'Dor do "aluguel"', status: "vencedor", primaryText: "Cansou?", headline: null, approvedAt: "2026-11-14T15:00:00Z", link: "https://x/criativos/1" },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Imobiliária";"Lançamento";"Vídeo";"Dor do ""aluguel""";"Vencedor";"Cansou?";"";"14/11/2026";"https://x/criativos/1"');
  });
  it("texto seguro para o PDF", () => {
    expect(pdfSafe("Ação “nova” – já ✨\nok")).toBe('Ação "nova" - já ? ok');
  });
});
