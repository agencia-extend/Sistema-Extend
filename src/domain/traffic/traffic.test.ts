import { describe, expect, it } from "vitest";
import { byMonth, currentBudget, dailyBudget } from ".";

describe("tráfego", () => {
  it("acha a verba vigente no dia (a mais recente que cobre a data)", () => {
    const list = [
      { id: "nov", periodStart: "2026-11-01", periodEnd: "2026-11-30" },
      { id: "extra", periodStart: "2026-11-20", periodEnd: "2026-11-30" },
      { id: "dez", periodStart: "2026-12-01", periodEnd: "2026-12-31" },
    ];
    expect(currentBudget(list, "2026-11-10")?.id).toBe("nov");
    expect(currentBudget(list, "2026-11-25")?.id).toBe("extra");
    expect(currentBudget(list, "2027-01-02")).toBeNull();
  });

  it("calcula a verba por dia do período", () => {
    expect(dailyBudget(310000, "2026-12-01", "2026-12-31")).toEqual({ days: 31, perDayCents: 10000 });
    expect(dailyBudget(5000, "2026-12-01", "2026-12-01")).toEqual({ days: 1, perDayCents: 5000 });
  });

  it("agrupa o registro por mês", () => {
    const g = byMonth([{ happenedOn: "2026-11-20" }, { happenedOn: "2026-11-02" }, { happenedOn: "2026-10-30" }]);
    expect(g.map((x) => [x.month, x.items.length])).toEqual([["2026-11", 2], ["2026-10", 1]]);
  });
});

describe("checklists do tráfego", () => {
  it("acha a segunda-feira da semana", async () => {
    const { weekStart } = await import(".");
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // domingo
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // segunda
    expect(weekStart("2026-11-20")).toBe("2026-11-16");
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
  });

  it("lista os problemas na ordem do checklist", async () => {
    const { checkProblems } = await import(".");
    expect(
      checkProblems("diario", [
        { key: "entrega", status: "problema", note: "Campanha X sem impressões" },
        { key: "saldo", status: "problema", note: "Saldo para 1 dia" },
        { key: "gasto", status: "ok" },
      ]),
    ).toEqual([
      { label: "Saldo e cobrança", note: "Saldo para 1 dia" },
      { label: "Entrega", note: "Campanha X sem impressões" },
    ]);
  });
});
