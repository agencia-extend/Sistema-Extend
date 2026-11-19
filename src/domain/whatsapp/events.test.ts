import { describe, expect, it } from "vitest";
import { ackAdvances, ackStatus, altPhone, bareMessageId, messageIdFromResponse, referralFromRaw } from "./events";

describe("eventos do WAHA", () => {
  it("usa o id cru da mensagem em todos os formatos", () => {
    expect(bareMessageId("true_5548999990000@c.us_3EB0ABC")).toBe("3EB0ABC");
    expect(bareMessageId("false_120363@g.us_3EB0XYZ_5548999990000@c.us")).toBe("3EB0XYZ");
    expect(bareMessageId("3EB0ABC")).toBe("3EB0ABC");
    expect(messageIdFromResponse({ id: { _serialized: "true_5548@c.us_3EB0Q" } })).toBe("3EB0Q");
    expect(messageIdFromResponse({ key: { id: "3EB0K" } })).toBe("3EB0K");
    expect(messageIdFromResponse(null)).toBeNull();
  });
  it("traduz as confirmações e só avança", () => {
    expect(ackStatus(1)).toBe("enviada");
    expect(ackStatus(3)).toBe("lida");
    expect(ackStatus(-1)).toBe("erro");
    expect(ackStatus(0)).toBeNull();
    expect(ackAdvances("entregue", "lida")).toBe(true);
    expect(ackAdvances("lida", "entregue")).toBe(false);
    expect(ackAdvances("lida", "erro")).toBe(false);
  });
  it("acha o telefone de quem tem id oculto", () => {
    expect(altPhone({ key: { remoteJid: "123@lid", remoteJidAlt: "5548999990000@s.whatsapp.net" } })).toBe("5548999990000");
    expect(altPhone({ key: { senderPn: "5511988887777@s.whatsapp.net" } })).toBe("5511988887777");
    expect(altPhone({ key: { remoteJid: "123@lid" } })).toBeNull();
  });
  it("lê o anúncio de origem, mesmo embrulhado", () => {
    const ad = { externalAdReply: { sourceId: "120210000", title: "Rodízio em dobro", sourceUrl: "https://fb.me/x", ctwaClid: "clid1" } };
    expect(referralFromRaw({ extendedTextMessage: { text: "oi", contextInfo: ad } })).toEqual({ sourceId: "120210000", headline: "Rodízio em dobro", url: "https://fb.me/x", ctwaClid: "clid1" });
    expect(referralFromRaw({ ephemeralMessage: { message: { extendedTextMessage: { contextInfo: ad } } } })?.sourceId).toBe("120210000");
    expect(referralFromRaw({ conversation: "oi" })).toBeNull();
    expect(referralFromRaw({ extendedTextMessage: { contextInfo: { externalAdReply: { title: "sem id" } } } })).toBeNull();
  });
});
