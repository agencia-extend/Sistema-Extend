import { describe, expect, it } from "vitest";
import { contactLabel, dayLabel, fillQuickReply, formatPhone, inboxHref, initials, listTime, matchQuickReplies, parseInboxFilters, parseInboxTab, shortcutQuery, waitingFor } from "./index";

describe("atendimento", () => {
  it("telefone brasileiro e de fora", () => {
    expect(formatPhone("5511999998888")).toBe("+55 (11) 99999-8888");
    expect(formatPhone("554833334444")).toBe("+55 (48) 3333-4444");
    expect(formatPhone("14155550100")).toBe("+14155550100");
    expect(formatPhone(null)).toBe("");
  });
  it("nome do contato: lead, WhatsApp, telefone", () => {
    expect(contactLabel({ contactName: "Ana", phone: "5511999998888", leadName: "Ana Souza" })).toBe("Ana Souza");
    expect(contactLabel({ contactName: "Ana", phone: "5511999998888" })).toBe("Ana");
    expect(contactLabel({ contactName: "", phone: "5511999998888" })).toBe("+55 (11) 99999-8888");
    expect(contactLabel({ contactName: "", phone: null })).toBe("Contato sem número");
  });
  it("aba", () => {
    expect(parseInboxTab("minhas")).toBe("minhas");
    expect(parseInboxTab("x")).toBe("abertas");
  });
});

describe("tela do atendimento", () => {
  it("filtros da URL limpos", () => {
    expect(parseInboxFilters({ aba: "radar", q: "  ana%(x) ", responsavel: "ninguem", etiqueta: "x" })).toEqual({ tab: "radar", q: "ana x", assignee: "ninguem", tag: undefined });
    expect(parseInboxFilters({})).toEqual({ tab: "abertas", q: undefined, assignee: undefined, tag: undefined });
    expect(inboxHref({ aba: "grupos", q: "x" }, { q: undefined, conversa: "1" })).toBe("/atendimento?aba=grupos&conversa=1");
  });
  it("iniciais, horários e espera", () => {
    expect(initials("Ana Maria Souza")).toBe("AS");
    expect(initials("+55 (11)")).toBe("51");
    expect(initials("")).toBe("?");
    const now = new Date("2026-11-18T15:00:00Z"); // 12:00 em São Paulo
    expect(listTime("2026-11-18T13:05:00Z", now)).toBe("10:05");
    expect(listTime("2026-11-17T13:05:00Z", now)).toBe("Ontem");
    expect(listTime("2026-11-01T13:05:00Z", now)).toBe("01/11/2026");
    expect(dayLabel("2026-11-18T13:05:00Z", now)).toBe("Hoje");
    expect(dayLabel("2026-11-02T13:05:00Z", now)).toBe("2 de novembro de 2026");
    expect(waitingFor("2026-11-18T14:52:00Z", now)).toBe("8 min");
    expect(waitingFor("2026-11-18T12:55:00Z", now)).toBe("2 h 5 min");
    expect(waitingFor("2026-11-15T15:00:00Z", now)).toBe("3 dias");
  });
  it("respostas rápidas", () => {
    expect(shortcutQuery("/pre")).toBe("pre");
    expect(shortcutQuery("/")).toBe("");
    expect(shortcutQuery("oi /pre")).toBeNull();
    expect(matchQuickReplies([{ shortcut: "preco" }, { shortcut: "pix" }, { shortcut: "oi" }], "p").map((r) => r.shortcut)).toEqual(["preco", "pix"]);
    expect(fillQuickReply("Oi {nome}, tudo bem?", "Ana Souza")).toBe("Oi Ana, tudo bem?");
  });
});
