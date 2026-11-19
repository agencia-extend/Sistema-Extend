import { describe, expect, it } from "vitest";
import { buildPayload, looksDone, matchMembers, parseTrello, trelloIdDate } from "./trello";

const id = (n: number) => `65a1b2c3${String(n).padStart(16, "0")}`;
const sample = {
  id: id(1),
  name: "Clínica Sorriso — Conteúdo",
  lists: [
    { id: id(10), name: "A fazer", closed: false, pos: 1 },
    { id: id(11), name: "Fazendo", closed: false, pos: 2 },
    { id: id(12), name: "Concluído", closed: false, pos: 3 },
    { id: id(13), name: "Velha", closed: true, pos: 4 },
  ],
  cards: [
    { id: id(20), name: "Reels de março", desc: "Roteiro no Drive", closed: false, idList: id(10), pos: 200, due: "2026-12-01T15:00:00.000Z", idMembers: [id(30), id(31)], labels: [{ name: "", color: "green" }, { name: "Urgente", color: "red_dark" }], attachments: [{ name: "Briefing", url: "https://drive.google.com/x" }, { name: "x", url: "javascript:alert(1)" }] },
    { id: id(21), name: "Carrossel", closed: false, idList: id(10), pos: 100, idMembers: [] },
    { id: id(22), name: "Post antigo", closed: true, idList: id(10), pos: 50 },
    { id: id(23), name: "Na lista arquivada", closed: false, idList: id(13), pos: 1 },
    { id: id(24), name: "Feito", closed: false, idList: id(12), pos: 1, dateLastActivity: "2026-11-01T10:00:00.000Z", idMembers: [id(31)] },
  ],
  checklists: [
    { id: id(40), idCard: id(20), name: "Roteiro", pos: 1, checkItems: [{ name: "Gancho", state: "complete", pos: 2 }, { name: "Texto", state: "incomplete", pos: 1 }] },
  ],
  members: [{ id: id(30), fullName: "Pricila Souza" }, { id: id(31), fullName: "Juliana" }, { id: id(32), fullName: "Sem cards" }],
  actions: [
    { type: "commentCard", date: "2026-10-02T12:00:00.000Z", memberCreator: { fullName: "Jacque" }, data: { text: "Segunda versão", card: { id: id(20) } } },
    { type: "commentCard", date: "2026-10-01T12:00:00.000Z", memberCreator: { fullName: "Luiz" }, data: { text: "Primeira", card: { id: id(20) } } },
    { type: "updateCard", date: "2026-10-01T12:00:00.000Z", data: {} },
  ],
};

describe("parseTrello", () => {
  it("recusa o que não é exportação do Trello", () => {
    expect(parseTrello("não é json").ok).toBe(false);
    expect(parseTrello(JSON.stringify({ id: "x", lists: [], cards: [] })).ok).toBe(false);
  });

  it("lê listas abertas, cards não arquivados, etiquetas, checklist, comentários e links", () => {
    const r = parseTrello(JSON.stringify(sample));
    if (!r.ok) throw new Error(r.message);
    const b = r.board;
    expect(b.columns.map((c) => [c.name, c.done, c.cards])).toEqual([["A fazer", false, 2], ["Fazendo", false, 0], ["Concluído", true, 1]]);
    expect(b.skipped).toEqual({ archivedCards: 1, closedLists: 1 });
    expect(b.cards.map((c) => c.title)).toEqual(["Carrossel", "Reels de março", "Feito"]);
    const reels = b.cards[1];
    expect(reels.pos).toBe(2000);
    expect(reels.labels).toEqual([{ name: "Verde", color: "#61BD4F" }, { name: "Urgente", color: "#EB5A46" }]);
    expect(reels.checklist).toEqual([{ title: "Texto", done: false }, { title: "Gancho", done: true }]);
    expect(reels.comments.map((c) => c.author)).toEqual(["Luiz", "Jacque"]);
    expect(reels.links).toEqual([{ name: "Briefing", url: "https://drive.google.com/x" }]);
    expect(reels.created).toBe(trelloIdDate(id(20)));
    expect(b.members.map((m) => [m.name, m.cards])).toEqual([["Pricila Souza", 1], ["Juliana", 2]]);
    expect(b.totals).toEqual({ comments: 2, checklistItems: 2, links: 1 });
    expect(b.commentsMayBeMissing).toBe(false);
  });

  it("sem lista de concluído, a última vira concluído", () => {
    const r = parseTrello(JSON.stringify({ ...sample, lists: sample.lists.slice(0, 2) }));
    if (!r.ok) throw new Error(r.message);
    expect(r.board.columns.map((c) => c.done)).toEqual([false, true]);
  });
});

describe("membros e envio", () => {
  it("associa pelo nome sem acento e não adivinha nome repetido", () => {
    const m = matchMembers(
      [{ id: "a", name: "Pricila Souza", cards: 1 }, { id: "b", name: "Juliana", cards: 1 }, { id: "c", name: "Ana", cards: 1 }],
      [{ id: "p1", name: "pricila  souza" }, { id: "j1", name: "Juliana" }, { id: "j2", name: "Juliana" }, { id: "x", name: "Outro" }],
    );
    expect(m).toEqual({ a: "p1", b: "", c: "" });
  });

  it("primeiro associado é o responsável; os outros participam", () => {
    const r = parseTrello(JSON.stringify(sample));
    if (!r.ok) throw new Error(r.message);
    const p = buildPayload(r.board, { name: " Conteúdo ", done: [false, false, true], members: { [id(30)]: "p1", [id(31)]: "j1" } });
    expect(p.name).toBe("Conteúdo");
    expect(p.cards[1]).toMatchObject({ assignee: "p1", participants: ["j1"] });
    expect(p.cards[0]).toMatchObject({ assignee: null, participants: [] });
    expect(p.columns[2]).toEqual({ name: "Concluído", color: "#22C55E", done: true });
  });

  it("reconhece listas de concluído", () => {
    expect(["Concluído", "Feito", "Publicados", "Done", "Aprovado"].every(looksDone)).toBe(true);
    expect(["A fazer", "Aprovação do cliente", "Em produção"].some(looksDone)).toBe(false);
  });
});
