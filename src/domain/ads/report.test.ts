import { describe, expect, it } from "vitest";
import { emptyTotals, kpis } from ".";
import { DEFAULT_REPORT_TEMPLATE, DEFAULT_SCHEDULE, buildAdsReport, lastWeek, renderReport, reportValues, sampleReportData, scheduleDue, scheduleKey, scheduleRange, spClock, unknownVariables, type ReportData } from "./report";

const totals = { ...emptyTotals(), spend_cents: 14000, impressions: 7000, clicks: 210, link_clicks: 140, messages: 28 };
const data = (over: Partial<ReportData["accounts"][number]> = {}): ReportData => ({
  clientName: "Clínica Sorriso",
  range: { start: "2026-11-09", end: "2026-11-15" },
  accounts: [{ name: "Conta 1", isPrepay: true, fundsCents: 5000, daysLeft: 2, totals, campaigns: [{ name: "Mensagens Clareamento", kind: "messages", totals, kpis: kpis(totals, "messages") }], ...over }],
  topAd: { name: "CR-3 Vídeo", kind: "messages", results: 20, costPerResultCents: 450 },
});

describe("relatório de anúncios", () => {
  it("semana anterior de segunda a domingo", () => {
    expect(lastWeek("2026-11-17")).toEqual({ start: "2026-11-09", end: "2026-11-15" }); // terça
    expect(lastWeek("2026-11-16")).toEqual({ start: "2026-11-09", end: "2026-11-15" }); // segunda
    expect(lastWeek("2026-11-15")).toEqual({ start: "2026-11-02", end: "2026-11-08" }); // domingo
  });

  it("modelo padrão: investimento, campanhas, destaque e saldo; sem gasto, nada", () => {
    const text = buildAdsReport(data())!;
    expect(text).toContain("*Relatório de anúncios — Clínica Sorriso*");
    expect(text).toContain("Período: 09/11 a 15/11");
    expect(text).toContain("Investimento: *R$ 140,00*");
    expect(text).toContain("Cliques: 140 · CTR 2%");
    expect(text).toContain("28 conversas · R$ 5,00 cada · CTR 2%");
    expect(text).toContain("Destaque: CR-3 Vídeo (20 conversas a R$ 4,50 cada)");
    expect(text).toContain("Saldo da conta: R$ 50,00 (dá para ~2 dias)");
    expect(buildAdsReport({ ...data(), accounts: [{ name: "C", isPrepay: false, fundsCents: null, daysLeft: null, totals: emptyTotals(), campaigns: [] }] })).toBeNull();
  });

  it("linha com variável vazia some (conta pós-paga, sem leads)", () => {
    const text = buildAdsReport({ ...data({ isPrepay: false, fundsCents: null, daysLeft: null }), topAd: null }, "Oi {cliente}\nCPL {cpl}\nConversas {conversas} a {custo_conversa}\nSaldo {saldo}\n\n\n\nFim")!;
    expect(text).toBe("Oi Clínica Sorriso\nConversas 28 a R$ 5,00\n\nFim");
  });

  it("todas as variáveis têm valor nos dados de exemplo e não sobra nenhuma no texto", () => {
    const v = reportValues(sampleReportData());
    expect(v.cpl).toBe("R$ 20,00");
    expect(v.custo_conversa).toBe("R$ 8,75");
    expect(v.roas).toBe("");
    const all = Object.keys(v).filter((k) => k !== "roas").map((k) => `{${k}}`).join("\n");
    expect(renderReport(all, v)).not.toMatch(/\{[a-z_]+\}/);
  });

  it("aponta variáveis desconhecidas", () => {
    expect(unknownVariables("{cliente} {Cliente} {custo_lead} {cpl} {custo_lead}")).toEqual(["custo_lead"]);
    expect(unknownVariables(DEFAULT_REPORT_TEMPLATE)).toEqual([]);
    expect(renderReport("{x} {cliente}", { cliente: "A" })).toBe("{x} A");
  });
});

describe("agenda do envio automático", () => {
  it("lê a hora e o dia em São Paulo", () => {
    expect(spClock(new Date("2026-11-16T12:05:00Z"))).toEqual({ date: "2026-11-16", hour: 9, isoDow: 1, day: 16 });
    expect(spClock(new Date("2026-12-01T02:00:00Z"))).toEqual({ date: "2026-11-30", hour: 23, isoDow: 1, day: 30 });
  });
  it("cobre ontem, a semana passada ou o mês passado", () => {
    expect(scheduleRange("diario", "2026-11-01")).toEqual({ start: "2026-10-31", end: "2026-10-31" });
    expect(scheduleRange("semanal", "2026-11-16")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    expect(scheduleRange("mensal", "2026-03-05")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(scheduleRange("mensal", "2026-01-10")).toEqual({ start: "2025-12-01", end: "2025-12-31" });
  });
  it("envia no dia certo a partir do horário", () => {
    const seg = { hour: 9, isoDow: 1, day: 16 };
    expect(scheduleDue(DEFAULT_SCHEDULE, seg)).toBe(true);
    expect(scheduleDue(DEFAULT_SCHEDULE, { ...seg, hour: 8 })).toBe(false);
    expect(scheduleDue(DEFAULT_SCHEDULE, { ...seg, isoDow: 2 })).toBe(false);
    expect(scheduleDue({ frequency: "mensal", monthDay: 16, hour: 14 }, { ...seg, hour: 15 })).toBe(true);
    expect(scheduleDue({ frequency: "mensal", monthDay: 5, hour: 9 }, seg)).toBe(false);
    expect(scheduleDue({ frequency: "diario", monthDay: 1, hour: 7 }, { hour: 7, isoDow: 7, day: 3 })).toBe(true);
    expect(scheduleDue({ frequency: "desligado", monthDay: 1, hour: 6 }, seg)).toBe(false);
  });
  it("não repete a chave da semanal antiga", () => {
    expect(scheduleKey("semanal", "c1", { start: "2026-11-09" })).toBe("relatorio:c1:2026-11-09");
    expect(scheduleKey("mensal", "c1", { start: "2026-10-01" })).toBe("relatorio:mensal:c1:2026-10-01");
  });
});
