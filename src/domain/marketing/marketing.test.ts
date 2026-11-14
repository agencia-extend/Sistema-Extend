import { describe, expect, it } from "vitest";
import { addMonths, creativeDueDay, dayParts, groupByMonth, lastDayOfMonth, monthTitle, requestDay, requestState } from "./index";

const base = { leadDays: 15, hasBrief: true, requestTaskId: null, requestedAt: null, requestError: null };

describe("calendário de marketing", () => {
  it("o pedido sai N dias antes da data", () => {
    expect(requestDay("2026-12-25", 15)).toBe("2026-12-10");
    expect(requestDay("2026-03-05", 10)).toBe("2026-02-23");
  });

  it("prazo do criativo: 5 dias antes, com no mínimo 2 dias de folga", () => {
    expect(creativeDueDay("2026-12-25", "2026-11-14")).toBe("2026-12-20");
    expect(creativeDueDay("2026-11-18", "2026-11-14")).toBe("2026-11-16");
  });

  it("situação do pedido", () => {
    expect(requestState({ ...base, hasBrief: false, onDate: "2026-12-25" }, "2026-11-14")).toEqual({ kind: "none" });
    expect(requestState({ ...base, onDate: "2026-12-25" }, "2026-11-14")).toEqual({ kind: "scheduled", on: "2026-12-10" });
    expect(requestState({ ...base, onDate: "2026-11-20" }, "2026-11-14")).toEqual({ kind: "scheduled", on: "2026-11-14" });
    expect(requestState({ ...base, onDate: "2026-11-20", requestTaskId: "t1", requestedAt: "x" }, "2026-11-14")).toEqual({ kind: "created", taskId: "t1" });
    expect(requestState({ ...base, onDate: "2026-11-20", requestError: "sem acesso" }, "2026-11-14")).toEqual({ kind: "error", message: "sem acesso" });
    expect(requestState({ ...base, onDate: "2026-11-10" }, "2026-11-14")).toEqual({ kind: "missed" });
  });

  it("meses e dias", () => {
    expect(addMonths("2026-11-14", 2)).toBe("2027-01-01");
    expect(lastDayOfMonth("2027-02-01")).toBe("2027-02-28");
    expect(monthTitle("2026-12-03")).toBe("Dezembro de 2026");
    expect(dayParts("2026-11-27")).toEqual({ day: 27, weekday: "sex", month: "novembro" });
  });

  it("agrupa por mês em ordem", () => {
    const g = groupByMonth([{ onDate: "2026-12-25" }, { onDate: "2026-11-27" }, { onDate: "2026-12-01" }]);
    expect(g.map((x) => [x.month, x.items.length])).toEqual([["2026-11-01", 1], ["2026-12-01", 2]]);
  });
});
