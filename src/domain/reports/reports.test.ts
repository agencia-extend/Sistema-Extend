import { describe, expect, it } from "vitest";
import { nextStep, reportAreas } from ".";

describe("relatórios ao cliente", () => {
  it("liga a área pelo serviço do cliente", () => {
    expect(reportAreas(["anuncios", "conteudo"])).toEqual(["trafego"]);
    expect(reportAreas(["gerenciamento", "conteudo", "anuncios"])).toEqual(["trafego", "conteudo"]);
    expect(reportAreas(["design"])).toEqual([]);
  });

  it("diz o próximo passo de cada retorno", () => {
    expect(nextStep("trafego", "negativo")).toMatch(/ajustar as campanhas/);
    expect(nextStep("conteudo", "negativo")).toMatch(/rever o conteúdo/);
    expect(nextStep("trafego", "positivo")).toMatch(/aumento de orçamento/);
    expect(nextStep("conteudo", "sem_retorno")).toMatch(/ligação/);
  });
});
