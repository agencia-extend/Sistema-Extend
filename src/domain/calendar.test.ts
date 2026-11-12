import { describe, expect, it } from "vitest";
import { calendarRange, shiftDay, spDayKey, spMidnight } from "./calendar";

describe("agenda", () => {
  it("meia-noite de São Paulo em UTC", () => {
    expect(spMidnight("2026-11-10").toISOString()).toBe("2026-11-10T03:00:00.000Z");
    expect(spDayKey("2026-11-11T02:00:00Z")).toBe("2026-11-10");
  });
  it("semana começa na segunda", () => {
    const r = calendarRange("semana", "2026-11-12"); // quinta
    expect(r.days[0]).toBe("2026-11-09");
    expect(r.days).toHaveLength(7);
    expect(r.end.toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });
  it("mês completa semanas", () => {
    const r = calendarRange("mes", "2026-11-20");
    expect(r.days[0]).toBe("2026-10-26");
    expect(r.days.length % 7).toBe(0);
    expect(r.days).toContain("2026-11-30");
  });
  it("navega", () => {
    expect(shiftDay("semana", "2026-11-12", 1)).toBe("2026-11-19");
    expect(shiftDay("mes", "2026-11-12", -1)).toBe("2026-10-01");
    expect(shiftDay("dia", "2026-12-31", 1)).toBe("2027-01-01");
  });
});
