import { describe, expect, it } from "vitest";
import { buildLeadRows, buildPanel, formatPhone, guessLeadMapping, normalizePhone, parseSource, slaState, type PanelLead } from ".";

describe("telefone", () => {
  it("normaliza com DDI 55 como o banco", () => {
    expect(normalizePhone("(51) 99999-0001")).toBe("5551999990001");
    expect(normalizePhone("+55 51 3333-4444")).toBe("555133334444");
    expect(normalizePhone("123")).toBeNull();
    expect(formatPhone("5551999990001")).toBe("(51) 99999-0001");
  });
});

describe("prazo na etapa", () => {
  it("atrasa ao completar os dias da etapa", () => {
    const now = new Date("2026-11-14T12:00:00Z");
    expect(slaState("2026-11-12T11:00:00Z", 2, now)).toEqual({ days: 2, late: true });
    expect(slaState("2026-11-13T13:00:00Z", 2, now)).toEqual({ days: 0, late: false });
    expect(slaState("2026-10-01T00:00:00Z", null, now).late).toBe(false);
  });
});

describe("painel", () => {
  const stages = [
    { id: "a", name: "Novo", kind: "aberta" as const, position: 1 },
    { id: "g", name: "Ganho", kind: "ganho" as const, position: 2 },
    { id: "p", name: "Perdido", kind: "perdido" as const, position: 3 },
  ];
  const base: PanelLead = { stageId: "a", source: "anuncio", valueCents: 100_00, ownerId: "u1", createdAt: "2026-11-05T12:00:00Z", wonAt: null, lostAt: null, lostReason: null };
  const leads: PanelLead[] = [
    base,
    { ...base, stageId: "g", wonAt: "2026-11-06T12:00:00Z", valueCents: 2000_00 },
    { ...base, stageId: "p", source: "indicacao", lostAt: "2026-11-07T12:00:00Z", lostReason: "Preço" },
    { ...base, stageId: "p", source: "indicacao", lostAt: "2026-11-08T12:00:00Z", lostReason: "Preço" },
    { ...base, createdAt: "2026-10-01T12:00:00Z" },
  ];
  const panel = buildPanel(leads, stages, new Map([["u1", "Ana"]]), { from: new Date("2026-11-01T03:00:00Z"), to: new Date("2026-12-01T03:00:00Z") });
  it("conta entradas, ganhos e conversão do período", () => {
    expect(panel.totals).toMatchObject({ leads: 4, won: 1, lost: 2, open: 2, wonCents: 2000_00 });
    expect(panel.totals.conversion).toBeCloseTo(1 / 3);
  });
  it("quebra por origem e motivos de perda", () => {
    expect(panel.bySource.find((r) => r.key === "indicacao")).toMatchObject({ leads: 2, lost: 2, conversion: 0 });
    expect(panel.lostReasons).toEqual([{ reason: "Preço", count: 2 }]);
    expect(panel.funnel).toEqual([{ id: "a", name: "Novo", count: 2, cents: 200_00 }]);
    expect(panel.byOwner[0].label).toBe("Ana");
  });
});

describe("importação", () => {
  it("adivinha colunas e lê origem", () => {
    expect(guessLeadMapping(["Nome", "WhatsApp", "E-mail", "Empresa", "Origem"])).toEqual({ Nome: "name", WhatsApp: "phone", "E-mail": "email", Empresa: "company", Origem: "source" });
    expect(parseSource("Facebook Ads")).toBe("anuncio");
    expect(parseSource("Indicação do João")).toBe("indicacao");
  });
  it("pula sem nome e repetidos dentro da planilha", () => {
    const mapping = { Nome: "name", Fone: "phone", Valor: "value" } as const;
    const { rows, problems } = buildLeadRows(
      [
        { Nome: "Loja A", Fone: "51 98888-0001", Valor: "1.500,00" },
        { Nome: "Loja A filial", Fone: "(51) 98888-0001", Valor: "" },
        { Nome: "", Fone: "", Valor: "" },
      ],
      mapping,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ phone: "5551988880001", value_cents: 150000 });
    expect(problems.map((p) => p.message)).toEqual(["repetido na planilha", "sem nome"]);
  });
});
