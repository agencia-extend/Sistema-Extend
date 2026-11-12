import { describe, expect, it } from "vitest";
import { buildReport, peopleCsv, type ReportTask } from "./report";

const now = new Date("2026-11-20T15:00:00Z");
const task = (over: Partial<ReportTask>): ReportTask => ({
  id: Math.random().toString(36),
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
