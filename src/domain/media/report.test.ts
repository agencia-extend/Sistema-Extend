import { describe, expect, it } from "vitest";
import { buildReport, drillTasks, parseDrill, peopleCsv, type ReportTask } from "./report";

const now = new Date("2026-11-20T15:00:00Z");
const task = (over: Partial<ReportTask>): ReportTask => ({
  id: Math.random().toString(36),
  title: "Conteúdo",
  type: "video",
  status: "concluido",
  dueAt: null,
  clientId: "c1",
  clientName: "Imobiliária",
  stepName: "Publicado",
  stepColor: "#22C55E",
  stepPosition: 10,
  editorId: "juliana",
  editorName: "Juliana",
  recorderId: null,
  recorderName: null,
  recordingOn: null,
  reworkCount: 0,
  ...over,
});

describe("relatório de produção", () => {
  const finished = [task({}), task({ reworkCount: 2 }), task({ type: "design", editorId: "pricila", editorName: "Pricila" })];
  const open = [
    task({ status: "em_andamento", stepName: "Edição", stepPosition: 5, dueAt: "2026-11-18T21:00:00Z" }),
    task({ status: "em_andamento", stepName: "Edição", stepPosition: 5, dueAt: "2026-11-25T21:00:00Z", recorderId: "caliton", recorderName: "Caliton", recordingOn: "2026-11-10" }),
    task({ status: "aguardando_aprovacao", stepName: "Revisão interna", stepPosition: 6, editorId: null, editorName: null }),
  ];
  const months = [{ clientId: "c1", number: 3, startsOn: "2026-11-14", endsOn: "2026-12-13" }];
  const slots = [
    { clientId: "c1", clientName: "Imobiliária", slotMonth: "2026-11-14", status: "concluido", dueAt: null },
    { clientId: "c1", clientName: "Imobiliária", slotMonth: "2026-11-14", status: "em_andamento", dueAt: "2026-11-18T21:00:00Z" },
    { clientId: "c1", clientName: "Imobiliária", slotMonth: "2026-11-14", status: "cancelado", dueAt: null },
    { clientId: "c1", clientName: "Imobiliária", slotMonth: "2026-10-14", status: "concluido", dueAt: null },
  ];
  const r = buildReport(finished, open, months, slots, { from: "2026-11-01", to: "2026-11-30" }, now);

  it("conta quantos conteúdos cada pessoa finalizou no período", () => {
    const juliana = r.people.find((p) => p.id === "juliana")!;
    expect(juliana).toMatchObject({ finished: 2, video: 2, design: 0, open: 2, late: 1, rework: 2 });
    expect(r.people.find((p) => p.id === "pricila")).toMatchObject({ finished: 1, design: 1 });
    expect(r.people[0].id).toBe("juliana");
  });

  it("conta as gravações feitas no período", () => {
    expect(r.people.find((p) => p.id === "caliton")?.recorded).toBe(1);
  });

  it("entregue × contratado usa só o mês atual do cliente e ignora cancelados", () => {
    expect(r.clients).toEqual([{ id: "c1", name: "Imobiliária", period: "14/11 a 14/12", number: 3, contracted: 2, delivered: 1, late: 1 }]);
  });

  it("mostra os gargalos por etapa, do maior para o menor", () => {
    expect(r.steps.map((s) => [s.name, s.count])).toEqual([["Edição", 2], ["Revisão interna", 1]]);
    expect(r.totals).toEqual({ finished: 3, open: 3, late: 1, rework: 2 });
  });

  it("exporta CSV com ponto e vírgula", () => {
    const csv = peopleCsv(r.people);
    expect(csv.split("\r\n")[1]).toBe('"Juliana";"2";"2";"0";"2";"1";"2";"0"');
  });
});

describe("números que abrem a lista", () => {
  const range = { from: "2026-11-01", to: "2026-11-30" };
  const finished = [task({ id: "f1", editorId: "juliana" }), task({ id: "f2", type: "design", editorId: "bia" })];
  const open = [
    task({ id: "o1", status: "em_andamento", editorId: "juliana", dueAt: "2026-11-19T21:00:00Z", stepName: "Edição", reworkCount: 1 }),
    task({ id: "o2", status: "em_andamento", editorId: "bia", dueAt: "2026-11-25T21:00:00Z", stepName: "Roteiro" }),
  ];
  it("lê o parâmetro", () => {
    expect(parseDrill("atrasados")).toEqual({ kind: "atrasados" });
    expect(parseDrill("etapa:Edição")).toEqual({ kind: "etapa", step: "Edição" });
    expect(parseDrill("pessoa:00000000-0000-4000-a000-000000000001:videos")).toEqual({ kind: "videos", personId: "00000000-0000-4000-a000-000000000001" });
    expect(parseDrill("qualquer")).toBeNull();
    expect(parseDrill("pessoa:x:videos")).toBeNull();
  });
  it("filtra com as mesmas regras do relatório", () => {
    expect(drillTasks({ kind: "atrasados" }, finished, open, range, now).map((t) => t.id)).toEqual(["o1"]);
    expect(drillTasks({ kind: "artes" }, finished, open, range, now).map((t) => t.id)).toEqual(["f2"]);
    expect(drillTasks({ kind: "etapa", step: "Roteiro" }, finished, open, range, now).map((t) => t.id)).toEqual(["o2"]);
    expect(drillTasks({ kind: "alteracoes" }, finished, open, range, now).map((t) => t.id)).toEqual(["o1"]);
  });
});
