import { describe, expect, it } from "vitest";
import { alertKindLabel, parseAlertTab, resolvedBy, tabStatus } from "./alerts";

describe("painel de alertas", () => {
  it("aba da URL, com abertos como padrão", () => {
    expect(parseAlertTab("resolvidos")).toBe("resolvidos");
    expect(parseAlertTab("x")).toBe("abertos");
    expect(parseAlertTab(undefined)).toBe("abertos");
    expect(tabStatus("reconhecidos")).toBe("reconhecido");
  });

  it("rótulos e quem resolveu", () => {
    expect(alertKindLabel("saldo")).toBe("Saldo acabando");
    expect(alertKindLabel("outro")).toBe("Alerta");
    expect(resolvedBy({ resolvedById: null, resolvedName: null })).toBe("Resolvido sozinho");
    expect(resolvedBy({ resolvedById: "u", resolvedName: "Ana" })).toBe("Resolvido por Ana");
  });
});
