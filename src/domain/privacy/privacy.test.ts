import { describe, expect, it } from "vitest";
import { deadlineState, formatCnpj, isValidCnpj } from ".";

describe("privacidade", () => {
  it("valida e formata CNPJ", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
  });

  it("acompanha o prazo legal de 15 dias", () => {
    expect(deadlineState("2026-11-28", "aberto", "2026-11-13")).toBe("no_prazo");
    expect(deadlineState("2026-11-15", "em_andamento", "2026-11-13")).toBe("vence_logo");
    expect(deadlineState("2026-11-12", "aberto", "2026-11-13")).toBe("atrasado");
    expect(deadlineState("2026-11-12", "concluido", "2026-11-13")).toBe("fechado");
  });
});
