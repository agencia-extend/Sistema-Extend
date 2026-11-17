import { describe, expect, it } from "vitest";
import { emptyTotals, kpis } from ".";
import { buildAdsReport, lastWeek } from "./report";

describe("relatório de anúncios", () => {
  it("semana anterior de segunda a domingo", () => {
    expect(lastWeek("2026-11-17")).toEqual({ start: "2026-11-09", end: "2026-11-15" }); // terça
    expect(lastWeek("2026-11-16")).toEqual({ start: "2026-11-09", end: "2026-11-15" }); // segunda
    expect(lastWeek("2026-11-15")).toEqual({ start: "2026-11-02", end: "2026-11-08" }); // domingo
  });

  it("texto com investimento, campanhas, resultado e saldo; sem gasto, nada", () => {
    const totals = { ...emptyTotals(), spend_cents: 14000, impressions: 7000, clicks: 210, link_clicks: 140, messages: 28 };
    const text = buildAdsReport({
      clientName: "Clínica Sorriso",
      range: { start: "2026-11-09", end: "2026-11-15" },
      accounts: [{ name: "Conta 1", isPrepay: true, fundsCents: 5000, daysLeft: 2, totals, campaigns: [{ name: "Mensagens Clareamento", kind: "messages", totals, kpis: kpis(totals, "messages") }] }],
    })!;
    expect(text).toContain("*Relatório de anúncios — Clínica Sorriso*");
    expect(text).toContain("Período: 09/11 a 15/11");
    expect(text).toContain("Investimento: *R$ 140,00*");
    expect(text).toContain("28 conversas · R$ 5,00 cada · CTR 2%");
    expect(text).toContain("Saldo da conta: R$ 50,00 (dá para ~2 dias)");
    expect(buildAdsReport({ clientName: "X", range: { start: "2026-11-09", end: "2026-11-15" }, accounts: [{ name: "C", isPrepay: false, fundsCents: null, daysLeft: null, totals: emptyTotals(), campaigns: [] }] })).toBeNull();
  });
});
