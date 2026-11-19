import { describe, expect, it } from "vitest";
import { daysBetween, nextStatuses, plannedTotalCents, planPace, spendWindow } from "./plans";

describe("plano de campanha", () => {
  it("conta os dias inclusive", () => {
    expect(daysBetween("2026-11-01", "2026-11-30")).toBe(30);
    expect(daysBetween("2026-11-10", "2026-11-10")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(2);
  });

  it("orçamento previsto: total, diário vezes dias, diário sem fim", () => {
    expect(plannedTotalCents({ budgetType: "total", budgetCents: 90000, startDate: "2026-11-01", endDate: "2026-11-30" })).toBe(90000);
    expect(plannedTotalCents({ budgetType: "diario", budgetCents: 3000, startDate: "2026-11-01", endDate: "2026-11-10" })).toBe(30000);
    expect(plannedTotalCents({ budgetType: "diario", budgetCents: 3000, startDate: "2026-11-01", endDate: null })).toBeNull();
  });

  it("janela do gasto: antes do início nada; depois do fim, até o fim", () => {
    expect(spendWindow("2026-12-01", null, "2026-11-19")).toBeNull();
    expect(spendWindow("2026-11-01", "2026-11-10", "2026-11-19")).toEqual({ start: "2026-11-01", end: "2026-11-10" });
    expect(spendWindow("2026-11-01", null, "2026-11-19")).toEqual({ start: "2026-11-01", end: "2026-11-19" });
  });

  it("ritmo: dentro de 15% está no ritmo; fora, acima ou abaixo", () => {
    const daily = { budgetType: "diario" as const, budgetCents: 2000, startDate: "2026-11-13", endDate: null };
    expect(planPace(daily, 14000, "2026-11-19")).toMatchObject({ tone: "ok" }); // 7 dias × R$ 20
    expect(planPace(daily, 20000, "2026-11-19")).toMatchObject({ tone: "acima", label: expect.stringContaining("143%") });
    expect(planPace(daily, 5000, "2026-11-19")).toMatchObject({ tone: "abaixo" });
    const total = { budgetType: "total" as const, budgetCents: 30000, startDate: "2026-11-01", endDate: "2026-11-30" };
    expect(planPace(total, 19000, "2026-11-19")).toMatchObject({ tone: "ok" }); // 19 de 30 dias → R$ 190
    expect(planPace({ ...daily, startDate: "2026-12-01" }, 0, "2026-11-19")).toBeNull();
  });

  it("situações seguintes", () => {
    expect(nextStatuses("rascunho")).toEqual(["aprovado"]);
    expect(nextStatuses("no_ar")).toEqual(["encerrado"]);
  });
});
