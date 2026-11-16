import { describe, expect, it } from "vitest";
import { gridOrder, monthLabel, monthParam, monthRange, postState, shiftMonth, weekOf } from ".";

describe("cronograma", () => {
  it("mês e intervalos", () => {
    expect(monthParam("2026-02", "2026-11-14")).toBe("2026-02");
    expect(monthParam("2026-13", "2026-11-14")).toBe("2026-11");
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-11")).toBe("novembro de 2026");
  });

  it("semana de segunda a domingo", () => {
    expect(weekOf("2026-11-14")).toEqual({ key: "2026-11-09", label: "Semana de 09/11 a 15/11" });
    expect(weekOf("2026-11-16").key).toBe("2026-11-16");
  });

  it("situação do post e ordem do grid", () => {
    expect(postState("2026-11-20", null)).toBe("programado");
    expect(postState("2026-11-20", "https://instagram.com/p/x")).toBe("postado");
    expect(postState(null, null)).toBe("sem_data");
    const g = gridOrder([{ id: 1, postOn: "2026-11-02" }, { id: 2, postOn: null }, { id: 3, postOn: "2026-11-20" }]);
    expect(g.map((p) => p.id)).toEqual([3, 1]);
  });
});

describe("cronogramas do mês", () => {
  it("diz quantos posts faltam e se o mês está completo", async () => {
    const { monthStatus } = await import(".");
    expect(monthStatus(12, 8)).toEqual({ complete: false, missing: 4 });
    expect(monthStatus(12, 14)).toEqual({ complete: true, missing: 0 });
    expect(monthStatus(0, 0)).toEqual({ complete: true, missing: 0 });
  });

  it("ordena os que faltam mais primeiro", async () => {
    const { byMissing } = await import(".");
    const rows = [
      { clientName: "Beta", contracted: 8, scheduled: 8 },
      { clientName: "Alfa", contracted: 8, scheduled: 6 },
      { clientName: "Gama", contracted: 12, scheduled: 2 },
    ];
    expect(byMissing(rows).map((r) => r.clientName)).toEqual(["Gama", "Alfa", "Beta"]);
  });
});
