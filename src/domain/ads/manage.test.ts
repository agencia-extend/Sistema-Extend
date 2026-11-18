import { describe, expect, it } from "vitest";
import { changeEntry, manageErrorMessage } from "./manage";

const nb = (s: string) => s.replace(/ /g, " ");

describe("changeEntry", () => {
  it("pausar e ativar", () => {
    expect(changeEntry({ kind: "status", level: "campaign", name: "Leads", active: false })).toEqual({ category: "pausa", what: 'Pausou a campanha "Leads" pelo sistema.' });
    expect(changeEntry({ kind: "status", level: "ad", name: "Vídeo 1", active: true })).toEqual({ category: "ativacao", what: 'Ativou o anúncio "Vídeo 1" pelo sistema.' });
  });
  it("orçamento com o antes e o depois", () => {
    const e = changeEntry({ kind: "budget", level: "adset", name: "Frio", fromCents: 5000, toCents: 7000 });
    expect(e.category).toBe("orcamento");
    expect(nb(e.what)).toBe('Orçamento diário do conjunto "Frio": R$ 50,00 → R$ 70,00.');
  });
  it("renomear e duplicar", () => {
    expect(changeEntry({ kind: "rename", level: "campaign", from: "A", to: "B" }).what).toBe('Renomeou a campanha "A" para "B".');
    expect(changeEntry({ kind: "duplicate", level: "campaign", name: "A" }).what).toBe('Duplicou a campanha "A" (a cópia nasce pausada).');
  });
});

describe("manageErrorMessage", () => {
  it("token vencido, sem permissão, limite e motivo da Meta", () => {
    expect(manageErrorMessage(190, undefined, undefined)).toContain("expirou");
    expect(manageErrorMessage(200, undefined, "x")).toContain("ads_management");
    expect(manageErrorMessage(17, undefined, undefined)).toContain("limitou");
    expect(manageErrorMessage(100, 1885272, "O orçamento diário precisa ser de pelo menos R$ 5,00.")).toBe("A Meta não aceitou: O orçamento diário precisa ser de pelo menos R$ 5,00.");
    expect(manageErrorMessage(100, undefined, undefined)).toContain("Gerenciador");
  });
});
