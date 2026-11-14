import { describe, expect, it } from "vitest";
import { clientCode, clientTabs, contractWindow, deliveredPercent, journeyStage } from "./index";
import { buildRows, guessMapping, parseDateBR, parseServiceCell } from "./import";
import { centsToInput, formatBRL, parseBRL } from "@/domain/shared/money";

describe("abas do cliente", () => {
  it("em onboarding mostra só visão geral, ficha, reuniões, contratos e arquivos", () => {
    expect(clientTabs("onboarding", ["videos"], { "tasks.read": "all" }).map((t) => t.label)).toEqual([
      "Visão geral",
      "Ficha",
      "Reuniões",
      "Contratos",
      "Arquivos",
    ]);
  });
  it("nº com três dígitos e situação do fim do contrato", () => {
    expect(clientCode(7)).toBe("007");
    expect(clientCode(1234)).toBe("1234");
    expect(contractWindow(null, "2026-11-14")).toBe("sem");
    expect(contractWindow("2026-11-13", "2026-11-14")).toBe("vencido");
    expect(contractWindow("2026-11-20", "2026-11-14")).toBe("termina_logo");
    expect(contractWindow("2026-12-10", "2026-11-14")).toBe("termina");
    expect(contractWindow("2027-03-01", "2026-11-14")).toBe("ok");
  });
  it("ativo com vídeos e permissão mostra demanda do mês", () => {
    const keys = clientTabs("ativo", ["videos"], { "tasks.read": "own" }).map((t) => t.key);
    expect(keys).toContain("midias");
    expect(keys).toContain("historico");
  });
  it("só tráfego não mostra demanda do mês", () => {
    expect(clientTabs("ativo", ["anuncios"], { "tasks.read": "all" }).map((t) => t.key)).not.toContain("midias");
  });
});

describe("progresso", () => {
  it("percentual", () => {
    expect(deliveredPercent(3, 4)).toBe(75);
    expect(deliveredPercent(5, 4)).toBe(100);
    expect(deliveredPercent(0, 0)).toBeNull();
  });
  it("etapa da jornada", () => {
    expect(journeyStage("onboarding", 3, 10)).toBe("Onboarding 3/10");
    expect(journeyStage("ativo", 0, 0)).toBe("Execução");
  });
});

describe("dinheiro em centavos", () => {
  it("converte", () => {
    expect(parseBRL("1.500,50")).toBe(150050);
    expect(parseBRL("R$ 10")).toBe(1000);
    expect(parseBRL("abc")).toBeNull();
    expect(centsToInput(150050)).toBe("1.500,50");
    expect(formatBRL(null)).toBe("—");
  });
});

describe("importação", () => {
  const services = [
    { id: "v", name: "Pacote de vídeos", key: "pacote_videos" },
    { id: "g", name: "Gerenciamento de redes", key: "gerenciamento" },
  ];
  it("datas brasileiras", () => {
    expect(parseDateBR("10/11/2026")).toBe("2026-11-10");
    expect(parseDateBR("2026-11-10")).toBe("2026-11-10");
    expect(parseDateBR("31/02/2026")).toBeNull();
    expect(parseDateBR("")).toBeNull();
  });
  it("células de serviço", () => {
    expect(parseServiceCell("4")).toBe(4);
    expect(parseServiceCell("sim")).toBe(0);
    expect(parseServiceCell("não")).toBeNull();
  });
  it("adivinha o mapeamento e monta as linhas", () => {
    const map = guessMapping(["Cliente", "Nicho", "Início", "Fim", "Vídeos", "Gerenciamento"], services);
    expect(map).toMatchObject({ Cliente: "name", Nicho: "segment", Início: "contract_start", Fim: "contract_end", Vídeos: "service:v", Gerenciamento: "service:g" });
    const { rows, problems } = buildRows(
      [
        { Cliente: "Ótica Visão", Nicho: "Varejo", Início: "01/10/2026", Fim: "30/09/2027", Vídeos: "4", Gerenciamento: "sim" },
        { Cliente: "", Nicho: "x" },
        { Cliente: "Clínica", Início: "99/99/2026" },
      ],
      map,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "Ótica Visão", contract_start: "2026-10-01", services: [{ service_id: "v", monthly_qty: 4 }, { service_id: "g", monthly_qty: 0 }] });
    expect(problems.map((p) => p.line)).toEqual([3, 4]);
  });
});
