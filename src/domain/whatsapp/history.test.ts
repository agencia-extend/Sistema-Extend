import { describe, expect, it } from "vitest";
import { chatKind, historyMessage, isActiveImport, looksLikePhone, phoneOfJid, validServerUrl } from "./history";

describe("chatKind", () => {
  it("separa contato, grupo e o que fica de fora", () => {
    expect(chatKind("5511987654321@c.us")).toBe("contato");
    expect(chatKind("123456789012345@lid")).toBe("contato");
    expect(chatKind("120363000000000001@g.us")).toBe("grupo");
    expect(chatKind("status@broadcast")).toBe("ignorar");
    expect(chatKind("120363@newsletter")).toBe("ignorar");
  });
});

describe("phoneOfJid", () => {
  it("só tira telefone de contato com número", () => {
    expect(phoneOfJid("5511987654321@c.us")).toBe("5511987654321");
    expect(phoneOfJid("5511987654321:12@s.whatsapp.net")).toBe("5511987654321");
    expect(phoneOfJid("123456789@lid")).toBeNull();
    expect(phoneOfJid("120363000000000001@g.us")).toBeNull();
    expect(phoneOfJid(null)).toBeNull();
  });
  it("nome que é telefone não vale como nome", () => {
    expect(looksLikePhone("+55 48 99999-0000")).toBe(true);
    expect(looksLikePhone("Marina")).toBe(false);
  });
});

describe("historyMessage", () => {
  const ts = 1_763_400_000;
  it("mensagem de contato com o nome e o telefone alternativo", () => {
    const m = historyMessage({ id: "false_123@lid_3EB0AA", timestamp: ts, fromMe: false, body: "Oi!", _data: { pushName: "Marina", key: { remoteJidAlt: "5511987654321@s.whatsapp.net" } } }, false);
    expect(m).toEqual({ wamid: "3EB0AA", from_me: false, author: null, author_name: "Marina", body: "Oi!", kind: "text", sent_at: new Date(ts * 1000).toISOString(), alt: "5511987654321@s.whatsapp.net", pushName: "Marina" });
  });
  it("mídia sem legenda entra como mídia; em grupo guarda quem escreveu", () => {
    const m = historyMessage({ id: "x1", timestamp: ts, fromMe: false, hasMedia: true, participant: "5548999990000@c.us", _data: { pushName: "Caio" } }, true);
    expect(m).toMatchObject({ kind: "media", body: null, author: "5548999990000@c.us", author_name: "Caio" });
  });
  it("enviada pela Extend não tem autor nem nome", () => {
    expect(historyMessage({ id: "true_x", timestamp: ts, fromMe: true, body: "Olá", _data: { pushName: "Extend" } }, true)).toMatchObject({ from_me: true, author: null, author_name: null });
  });
  it("mensagem de sistema ou sem data fica de fora", () => {
    expect(historyMessage({ id: "y", timestamp: ts, fromMe: false }, false)).toBeNull();
    expect(historyMessage({ id: "y", body: "oi" }, false)).toBeNull();
    expect(historyMessage("lixo", false)).toBeNull();
  });
});

describe("validServerUrl", () => {
  it("aceita https público e tira a barra do fim", () => {
    expect(validServerUrl("https://abc-def.trycloudflare.com/", false)).toBe("https://abc-def.trycloudflare.com");
    expect(validServerUrl("https://whatsapp.agenciaextend.com.br", false)).toBe("https://whatsapp.agenciaextend.com.br");
  });
  it("recusa http, rede interna e endereço com usuário", () => {
    expect(validServerUrl("http://abc.trycloudflare.com", false)).toBeNull();
    expect(validServerUrl("https://192.168.0.10", false)).toBeNull();
    expect(validServerUrl("https://user:pw@abc.com", false)).toBeNull();
    expect(validServerUrl("não é endereço", false)).toBeNull();
  });
  it("local só quando o sistema roda na máquina", () => {
    expect(validServerUrl("http://127.0.0.1:3032", false)).toBeNull();
    expect(validServerUrl("http://127.0.0.1:3032/", true)).toBe("http://127.0.0.1:3032");
  });
});

it("compilação ativa", () => {
  expect(isActiveImport({ status: "aguardando" })).toBe(true);
  expect(isActiveImport({ status: "concluida" })).toBe(false);
  expect(isActiveImport(null)).toBe(false);
});
