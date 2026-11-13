import { describe, expect, it } from "vitest";
import { periodStart, summarize, type OpsTask } from "./index";

// Quinta, 12/11/2026 15:00 em São Paulo.
const now = new Date("2026-11-12T18:00:00Z");
const t = (over: Partial<OpsTask>): OpsTask => ({
  id: Math.random().toString(36),
  title: "Demanda",
  type: "video",
  status: "em_andamento",
  priority: "media",
  dueAt: null,
  completedAt: null,
  assigneeId: "ju",
  assigneeName: "Juliana",
  clientId: "c1",
  clientName: "Imobiliária",
  ...over,
});

describe("períodos do painel", () => {
  it("começam à meia-noite de São Paulo; a semana começa na segunda", () => {
    expect(periodStart("hoje", now)).toBe("2026-11-12T03:00:00.000Z");
    expect(periodStart("semana", now)).toBe("2026-11-09T03:00:00.000Z");
    expect(periodStart("mes", now)).toBe("2026-11-01T03:00:00.000Z");
    expect(periodStart("todos", now)).toBeNull();
  });
});

describe("resumo operacional", () => {
  const tasks = [
    t({ title: "Atrasada", dueAt: "2026-11-10T21:00:00Z" }),
    t({ title: "Urgente", priority: "urgente", dueAt: "2026-11-20T21:00:00Z" }),
    t({ title: "Revisão", status: "aguardando_aprovacao", assigneeId: "jack", assigneeName: "Jackeline" }),
    t({ title: "Sem dono", status: "pendente", assigneeId: null, assigneeName: null }),
    t({ title: "Feita hoje", status: "concluido", completedAt: "2026-11-12T15:00:00Z", type: "design" }),
    t({ title: "Feita mês passado", status: "concluido", completedAt: "2026-10-20T15:00:00Z" }),
  ];

  it("conta o momento e o período", () => {
    const r = summarize(tasks, "mes", null, now);
    expect(r.kpis).toEqual({ doing: 2, review: 1, done: 1, late: 1, unassigned: 1 });
    expect(summarize(tasks, "todos", null, now).kpis.done).toBe(2);
  });

  it("lista primeiro as atrasadas, depois as urgentes", () => {
    expect(summarize(tasks, "mes", null, now).urgent.map((x) => x.title)).toEqual(["Atrasada", "Urgente"]);
  });

  it("filtra por pessoa", () => {
    const r = summarize(tasks, "mes", "jack", now);
    expect(r.kpis).toEqual({ doing: 0, review: 1, done: 0, late: 0, unassigned: 0 });
  });

  it("entregas do período por tipo e situação por pessoa", () => {
    const r = summarize(tasks, "mes", null, now);
    expect(r.byType).toEqual([{ type: "design", count: 1 }]);
    expect(r.people[0]).toMatchObject({ id: "ju", late: 1, open: 2, done: 1 });
  });
});
