import { describe, expect, it } from "vitest";
import { contactLabel, formatPhone, parseInboxTab } from "./index";

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
