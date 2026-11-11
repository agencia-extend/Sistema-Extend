import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatRelative } from "./dates";

describe("datas em America/Sao_Paulo", () => {
  it("converte UTC para o horário de Brasília", () => {
    expect(formatDateTime("2026-11-10T17:30:00Z")).toBe("10/11/2026 14:30");
    expect(formatDate("2026-11-11T02:00:00Z")).toBe("10/11/2026");
  });
  it("relativo", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(formatRelative("2026-11-10T11:59:30Z", now)).toBe("agora");
    expect(formatRelative("2026-11-10T11:55:00Z", now)).toBe("há 5 minutos");
    expect(formatRelative("2026-11-08T12:00:00Z", now)).toBe("há 2 dias");
  });
});
