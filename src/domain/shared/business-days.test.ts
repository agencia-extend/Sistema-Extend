import { describe, expect, it } from "vitest";
import { addBusinessDays, easter, isBusinessDay } from "./business-days";

describe("dias úteis", () => {
  it("calcula a Páscoa", () => {
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
  });

  it("pula fim de semana e feriados nacionais (mesmos resultados do banco)", () => {
    expect(addBusinessDays("2026-11-13", 2)).toBe("2026-11-17");
    expect(addBusinessDays("2026-11-19", 1)).toBe("2026-11-23"); // 20/11 Consciência Negra
    expect(addBusinessDays("2026-12-24", 1)).toBe("2026-12-28"); // Natal + fim de semana
    expect(addBusinessDays("2026-04-02", 1)).toBe("2026-04-06"); // Sexta-feira Santa
    expect(addBusinessDays("2026-11-14", 0)).toBe("2026-11-14"); // imediato
  });

  it("reconhece dia útil", () => {
    expect(isBusinessDay("2026-11-16")).toBe(true);
    expect(isBusinessDay("2026-11-15")).toBe(false);
    expect(isBusinessDay("2026-09-07")).toBe(false);
  });
});
