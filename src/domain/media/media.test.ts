import { describe, expect, it } from "vitest";
import { addMonths, boardGroupOf, cycleOf, periodLabel, targetStep, type FlowStep } from "./index";

describe("mês do cliente", () => {
  it("começa no dia de início do contrato e vira no mesmo dia do mês seguinte", () => {
    expect(cycleOf("2026-08-14", "2026-08-14")).toEqual({ number: 1, startsOn: "2026-08-14", endsOn: "2026-09-13" });
    expect(cycleOf("2026-08-14", "2026-09-13")?.number).toBe(1);
    expect(cycleOf("2026-08-14", "2026-09-14")).toEqual({ number: 2, startsOn: "2026-09-14", endsOn: "2026-10-13" });
    expect(cycleOf("2026-08-14", "2027-08-20")?.number).toBe(13);
  });

  it("não existe antes do início do contrato", () => {
    expect(cycleOf("2026-08-14", "2026-08-13")).toBeNull();
  });

  it("dia 31 cai no último dia dos meses curtos e volta ao 31", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(cycleOf("2026-01-31", "2026-02-28")).toEqual({ number: 2, startsOn: "2026-02-28", endsOn: "2026-03-30" });
    expect(cycleOf("2026-01-31", "2026-02-27")?.number).toBe(1);
  });

  it("mostra o período como a equipe fala (14 a 14)", () => {
    expect(periodLabel("2026-08-14", "2026-09-13")).toBe("14/08 a 14/09");
    expect(periodLabel("2026-12-14", "2027-01-13")).toBe("14/12 a 14/01");
  });
});

describe("quadro do setor", () => {
  const ED = "edicao";
  const step = (id: string, position: number, sectorId: string, status: string, extra: Partial<FlowStep> = {}): FlowStep => ({ id, position, sectorId, status, waitsClient: false, isRework: false, ...extra });
  const video: FlowStep[] = [
    step("briefing", 1, "conteudo", "pendente"),
    step("roteiro", 2, "conteudo", "em_andamento"),
    step("aprov_roteiro", 3, "conteudo", "aguardando_aprovacao", { waitsClient: true }),
    step("gravacao", 4, "gravacao", "em_andamento"),
    step("edicao", 5, ED, "em_andamento"),
    step("revisao", 6, "conteudo", "aguardando_aprovacao"),
    step("aprov_cliente", 7, "conteudo", "aguardando_aprovacao", { waitsClient: true }),
    step("ajustes", 8, ED, "em_andamento", { isRework: true }),
    step("programado", 9, "gerenciamento", "aprovado"),
    step("publicado", 10, "gerenciamento", "concluido"),
  ];

  it("tudo antes da edição é 'Não iniciado' para a editora", () => {
    for (const id of ["briefing", "roteiro", "aprov_roteiro", "gravacao"]) expect(boardGroupOf(video, id, ED)).toBe("nao_iniciado");
  });

  it("mapeia as demais etapas para as colunas do Trello", () => {
    expect(boardGroupOf(video, "edicao", ED)).toBe("em_andamento");
    expect(boardGroupOf(video, "ajustes", ED)).toBe("em_andamento");
    expect(boardGroupOf(video, "revisao", ED)).toBe("aprovacao_interna");
    expect(boardGroupOf(video, "aprov_cliente", ED)).toBe("aprovacao_cliente");
    expect(boardGroupOf(video, "programado", ED)).toBe("cronograma");
    expect(boardGroupOf(video, "publicado", ED)).toBe("finalizado");
  });

  it("pegar o card leva à etapa de edição", () => {
    expect(targetStep(video, ED, "em_andamento", "gravacao")).toBe("edicao");
  });

  it("voltar de uma aprovação para 'Em andamento' é alteração (retrabalho)", () => {
    expect(targetStep(video, ED, "em_andamento", "revisao")).toBe("ajustes");
    expect(targetStep(video, ED, "em_andamento", "aprov_cliente")).toBe("ajustes");
  });

  it("soltar na mesma coluna não troca a etapa", () => {
    expect(targetStep(video, ED, "em_andamento", "ajustes")).toBe("ajustes");
    expect(targetStep(video, ED, "nao_iniciado", "roteiro")).toBe("roteiro");
  });

  it("demais colunas levam à primeira etapa da coluna", () => {
    expect(targetStep(video, ED, "aprovacao_interna", "edicao")).toBe("revisao");
    expect(targetStep(video, ED, "finalizado", "programado")).toBe("publicado");
  });
});
