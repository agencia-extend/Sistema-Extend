import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildDoc, type ProposalSnapshot } from "@/domain/proposals";
import { renderProposalPdf } from "./proposal-pdf";

const snap: ProposalSnapshot = {
  number: 12,
  issuedAt: "2026-11-14",
  templateName: "Padrão",
  blocks: [
    { id: "capa", type: "capa", title: "Proposta comercial", body: "Preparada para **{cliente}**" },
    { id: "inv", type: "investimento", title: "Investimento", body: "Forma de pagamento: {forma_pagamento}" },
    { id: "cond", type: "condicoes", title: "Condições", body: "- Vale até {validade}" },
  ],
  clientName: "Clínica Sorriso Ação",
  contactName: "Marcos",
  contactPhone: null,
  contactEmail: null,
  sellerName: "Jorge",
  items: [
    { serviceId: null, name: "Facebook/Instagram Ads", description: "Gestão", priceCents: 200000, discountCents: 25000, quantity: 1, recurrence: "mensal" },
    { serviceId: null, name: "Site", description: "", priceCents: 150000, discountCents: 0, quantity: 1, recurrence: "unico" },
  ],
  paymentTerms: "Pix mensal",
  notes: "",
  validUntil: "2026-11-24",
};

describe("PDF da proposta", () => {
  it("traz nome, valores com desconto e validade (os mesmos da prévia)", async () => {
    const buf = await renderProposalPdf(buildDoc(snap));
    const pdf = await getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const c = await (await pdf.getPage(i)).getTextContent();
      text += c.items.map((x) => ("str" in x ? x.str : "")).join(" ") + "\n";
    }
    const flat = text.replace(/ /g, " ").replace(/\s+/g, " ");
    expect(flat).toContain("Clínica Sorriso Ação");
    expect(flat).toContain("R$ 1.750,00");
    expect(flat).toContain("R$ 1.500,00");
    expect(flat).toContain("− R$ 250,00");
    expect(flat).toContain("24/11/2026");
    expect(flat).toContain("Pix mensal");
    expect(flat).toContain("Agência Extend · Proposta nº 0012");
  }, 30_000);
});
