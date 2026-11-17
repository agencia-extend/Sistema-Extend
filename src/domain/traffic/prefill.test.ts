import { describe, expect, it } from "vitest";
import { dailyPrefill, shortList, type PrefillInput } from "./prefill";

const base: PrefillInput = {
  accounts: [{ name: "Conta A", isPrepay: true, fundsCents: 20_000, statusCode: 1, last7SpendCents: Array(7).fill(5_000), yesterdayCents: 5_000 }],
  campaigns: [
    { name: "Leads", dailyBudgetCents: 4_000, yesterdayCents: 3_000, startedBeforeYesterday: true },
    { name: "Mensagens", dailyBudgetCents: 2_000, yesterdayCents: 2_000, startedBeforeYesterday: true },
  ],
  rejectedAds: [],
  limits: { fundsDays: 3, fundsMinCents: null, dailySpendMaxCents: null },
};
const tz = (s: string) => s.replace(/ /g, " ");

describe("dailyPrefill", () => {
  it("sem conta ligada não preenche", () => {
    expect(dailyPrefill({ ...base, accounts: [] })).toBeNull();
  });
  it("tudo certo", () => {
    const p = dailyPrefill(base)!;
    expect(p.saldo.status).toBe("ok");
    expect(tz(p.saldo.note)).toBe("Conta A: saldo de R$ 200,00 (cerca de 4 dias)");
    expect(p.reprovados).toEqual({ status: "ok", note: "Nenhum anúncio reprovado em campanha ativa." });
    expect(tz(p.gasto.note)).toBe("Ontem: R$ 50,00 de R$ 60,00 de orçamento diário das campanhas ativas (83%).");
    expect(p.entrega).toEqual({ status: "ok", note: "2 campanhas ativas entregando." });
  });
  it("saldo curto, restrição, reprovados, gasto acima e campanha parada", () => {
    const p = dailyPrefill({
      ...base,
      accounts: [
        { ...base.accounts[0], fundsCents: 10_000 },
        { name: "Conta B", isPrepay: false, fundsCents: null, statusCode: 2, last7SpendCents: [], yesterdayCents: 0 },
      ],
      campaigns: [...base.campaigns, { name: "Nova", dailyBudgetCents: null, yesterdayCents: 0, startedBeforeYesterday: false }, { name: "Parada", dailyBudgetCents: null, yesterdayCents: 0, startedBeforeYesterday: true }],
      rejectedAds: ["A1", "A2", "A3", "A4"],
      limits: { fundsDays: 3, fundsMinCents: null, dailySpendMaxCents: 4_000 },
    })!;
    expect(p.saldo.status).toBe("problema");
    expect(tz(p.saldo.note)).toBe("Conta A: saldo de R$ 100,00 (cerca de 2 dias); Conta B: conta com restrição");
    expect(p.reprovados).toEqual({ status: "problema", note: "4 anúncios reprovados em campanha ativa: A1, A2, A3 e mais 1" });
    expect(p.gasto.status).toBe("problema");
    expect(tz(p.gasto.note)).toContain("acima do limite de R$ 40,00");
    expect(p.entrega).toEqual({ status: "problema", note: "Sem gasto ontem: Parada" });
  });
  it("saldo mínimo em valor e sem campanha ativa", () => {
    const p = dailyPrefill({ ...base, campaigns: [], limits: { fundsDays: 0, fundsMinCents: 25_000, dailySpendMaxCents: null } })!;
    expect(p.saldo.status).toBe("problema");
    expect(p.entrega).toEqual({ status: "na", note: "Nenhuma campanha ativa." });
    expect(tz(p.gasto.note)).toBe("Ontem: R$ 50,00.");
  });
  it("lista curta", () => {
    expect(shortList(["a", "b"])).toBe("a, b");
  });
});
