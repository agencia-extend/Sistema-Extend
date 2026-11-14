import { describe, expect, it } from "vitest";
import { addDaysSP, buildDoc, computeTotals, effectiveStatus, fillVariables, parseRich, totalSummary, unknownVariables, type ProposalSnapshot } from ".";

const items = [
  { serviceId: "a", name: "Facebook/Instagram Ads", description: "", priceCents: 200000, discountCents: 20000, quantity: 1, recurrence: "mensal" as const },
  { serviceId: "b", name: "Site", description: "", priceCents: 150000, discountCents: 0, quantity: 1, recurrence: "unico" as const },
  { serviceId: "c", name: "Pacote de vídeos", description: "", priceCents: 50000, discountCents: 0, quantity: 2, recurrence: "mensal" as const },
];

const snap: ProposalSnapshot = {
  number: 7,
  issuedAt: "2026-11-14",
  templateName: "Padrão",
  blocks: [
    { id: "1", type: "capa", title: "Proposta comercial", body: "Para **{cliente}**" },
    { id: "2", type: "diagnostico", title: "Diagnóstico", body: "{observacoes}" },
    { id: "3", type: "condicoes", title: "Condições", body: "- Vale até {validade}\n- Pagamento: {forma_pagamento}" },
    { id: "4", type: "imagem", title: "Foto", body: "", imagePath: null },
  ],
  clientName: "Clínica Sorriso",
  contactName: "Marcos",
  contactPhone: null,
  contactEmail: null,
  sellerName: "Jorge",
  items,
  paymentTerms: "",
  notes: "",
  validUntil: "2026-11-24",
};

describe("propostas", () => {
  it("soma mensal e único separados, com desconto por item", () => {
    const t = computeTotals(items);
    expect(t).toEqual({ monthlyCents: 280000, oneTimeCents: 150000, grossCents: 450000, discountCents: 20000 });
    expect(totalSummary(t).replace(/ /g, " ")).toBe("R$ 2.800,00 por mês + R$ 1.500,00 (valor único)");
  });

  it("preenche variáveis e aponta as desconhecidas", () => {
    expect(fillVariables("Oi {contato}, {x}", { contato: "Ana" })).toBe("Oi Ana, {x}");
    expect(unknownVariables("{cliente} {clinte} {link}")).toEqual(["clinte"]);
  });

  it("lê parágrafos, listas e negrito", () => {
    expect(parseRich("Olá **mundo**\nlinha 2\n\n- um\n- dois")).toEqual([
      { kind: "p", lines: [[{ text: "Olá ", bold: false }, { text: "mundo", bold: true }], [{ text: "linha 2", bold: false }]] },
      { kind: "ul", items: [[{ text: "um", bold: false }], [{ text: "dois", bold: false }]] },
    ]);
  });

  it("monta o documento: esconde bloco vazio e imagem sem arquivo", () => {
    const d = buildDoc(snap);
    expect(d.sections.map((s) => s.type)).toEqual(["capa", "condicoes"]);
    expect(d.number).toBe("0007");
    expect(d.validUntil).toBe("24/11/2026");
    const cond = d.sections[1].nodes[0];
    expect(cond.kind === "ul" && cond.items.map((x) => x[0].text)).toEqual(["Vale até 24/11/2026", "Pagamento: a combinar"]);
    expect(d.lines[2].totalCents).toBe(100000);
  });

  it("vence depois do último dia da validade (fuso de São Paulo)", () => {
    const now = new Date("2026-11-25T02:00:00Z"); // 23h do dia 24 em SP
    expect(effectiveStatus("enviada", "2026-11-24", now)).toBe("enviada");
    expect(effectiveStatus("visualizada", "2026-11-23", now)).toBe("expirada");
    expect(effectiveStatus("aceita", "2026-11-01", now)).toBe("aceita");
    expect(addDaysSP(10, now)).toBe("2026-12-04");
  });
});
