import { describe, expect, it } from "vitest";
import { goalLines, monthDays } from "./goals";

describe("metas de anúncios", () => {
  it("dias do mês e completos", () => {
    expect(monthDays("2026-11-17")).toEqual({ days: 30, elapsed: 16 });
    expect(monthDays("2026-02-01")).toEqual({ days: 28, elapsed: 0 });
  });

  it("progresso, projeção e situação de cada meta", () => {
    // 16 dias completos de 30: 40 leads → projeção 75 (meta 100: abaixo de 80%).
    const lines = goalLines(
      { resultKind: "leads", resultsTarget: 100, spendCents: 300000, maxCostCents: 4000, minRoas: null },
      { spendCents: 160000, results: 40, purchaseValueCents: 0 },
      "2026-11-17",
    );
    const by = Object.fromEntries(lines.map((l) => [l.key, l]));
    expect(by.results).toMatchObject({ actual: 40, projected: 75, state: "atencao" });
    expect(by.spend).toMatchObject({ projected: 300000, state: "ok" });
    expect(by.cost).toMatchObject({ actual: 4000, state: "ok", higherIsBetter: false });
    expect(lines.find((l) => l.key === "roas")).toBeUndefined();
  });

  it("começo do mês não projeta; custo sem resultado fica sem dados", () => {
    const lines = goalLines({ resultKind: "messages", resultsTarget: 50, spendCents: null, maxCostCents: 1000, minRoas: 3 }, { spendCents: 5000, results: 0, purchaseValueCents: 20000 }, "2026-11-02");
    expect(lines.map((l) => [l.key, l.state])).toEqual([["results", "sem_dados"], ["cost", "sem_dados"], ["roas", "ok"]]);
  });
});
