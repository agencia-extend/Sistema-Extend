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
