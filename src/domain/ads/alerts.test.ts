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

describe("limites dos alertas", () => {
  it("resumo em uma linha", async () => {
    const { limitsSummary, SYSTEM_LIMITS } = await import("./alerts");
    const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
    expect(limitsSummary(SYSTEM_LIMITS, brl)).toBe("saldo 3 dias ou menos · fadiga com frequência 3 e CTR 25% menor");
    expect(limitsSummary({ ...SYSTEM_LIMITS, fundsDays: 0, fundsMinCents: 10000, dailySpendMaxCents: 30000, noDelivery: false, fatigueEnabled: false }, brl))
      .toBe("saldo abaixo de R$ 100,00 · gasto do dia acima de R$ 300,00 · sem aviso de entrega parada · sem aviso de fadiga");
  });
});
