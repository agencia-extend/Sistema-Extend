import { describe, expect, it } from "vitest";
import { buildClientLeadRows, decodeCsv, guessClientLeadMapping, parseLeadDate, summarizeQuality } from "./client-leads";

describe("planilha de leads do cliente", () => {
  it("reconhece os cabeçalhos da Central de leads da Meta e de planilhas em português", () => {
    expect(guessClientLeadMapping(["id", "created_time", "ad_name", "campaign_id", "campaign_name", "form_name", "full_name", "phone_number", "email"])).toEqual({
      id: "id", created_time: "date", ad_name: "ad", campaign_id: "campaignId", campaign_name: "campaign", form_name: "form", full_name: "name", phone_number: "phone", email: "email",
    });
    expect(guessClientLeadMapping(["Data", "Nome", "WhatsApp", "Campanha", "Observação"])).toEqual({ Data: "date", Nome: "name", WhatsApp: "phone", Campanha: "campaign", Observação: "" });
  });

  it("lê datas da Meta, brasileiras, do Excel e só data", () => {
    expect(parseLeadDate("2026-11-10T14:22:31-03:00")).toBe("2026-11-10T17:22:31.000Z");
    expect(parseLeadDate("10/11/2026 14:22")).toBe("2026-11-10T17:22:00.000Z");
    expect(parseLeadDate("2026-11-10")).toBe("2026-11-10T03:00:00.000Z");
    expect(parseLeadDate(new Date("2026-11-10T17:00:00Z"))).toBe("2026-11-10T17:00:00.000Z");
    expect(parseLeadDate("31/02/2026")).toBeNull();
    expect(parseLeadDate("ontem")).toBeNull();
  });

  it("monta as linhas, tira o prefixo da Meta, deduplica e explica as recusadas", () => {
    const mapping = guessClientLeadMapping(["id", "created_time", "campaign_name", "full_name", "phone_number", "email"]);
    const { rows, skipped } = buildClientLeadRows(
      [
        { id: "111", created_time: "2026-11-10T10:00:00-03:00", campaign_name: "CLI_LEADS", full_name: "Ana", phone_number: "p:+5551999990001", email: "ANA@x.com" },
        { id: "111", created_time: "2026-11-10T10:00:00-03:00", campaign_name: "CLI_LEADS", full_name: "Ana", phone_number: "", email: "" },
        { id: "", created_time: "2026-11-11", campaign_name: "", full_name: "", phone_number: "(51) 98888-0002", email: "" },
        { id: "", created_time: "", campaign_name: "", full_name: "Sem data", phone_number: "", email: "" },
        { id: "", created_time: "2026-11-11", campaign_name: "", full_name: "", phone_number: "", email: "" },
      ],
      mapping,
    );
    expect(rows.map((r) => [r.external_key, r.phone, r.email])).toEqual([["id:111", "5551999990001", "ana@x.com"], ["tel:5551988880002", "5551988880002", null]]);
    expect(skipped).toEqual([
      { line: 3, reason: "repetido na planilha" },
      { line: 5, reason: "sem data do lead (use dd/mm/aaaa)" },
      { line: 6, reason: "sem nome, telefone ou e-mail" },
    ]);
  });
});

describe("resumo da qualidade", () => {
  it("qualificado = bom ou médio, sobre os avaliados; custo pelo gasto da campanha", () => {
    const { rows, total } = summarizeQuality(
      [
        { campaignId: "c1", campaignName: "A", quality: "bom" },
        { campaignId: "c1", campaignName: "A", quality: "medio" },
        { campaignId: "c1", campaignName: "A", quality: "ruim" },
        { campaignId: "c1", campaignName: "A", quality: null },
        { campaignId: null, campaignName: "Antiga", quality: "nao_atendeu" },
        { campaignId: null, campaignName: null, quality: null },
      ],
      new Map([["c1", 30000]]),
    );
    const a = rows[0];
    expect([a.label, a.leads, a.rated, a.qualified, a.pctQualified, a.costPerQualifiedCents]).toEqual(["A", 4, 3, 2, 2 / 3, 15000]);
    expect(rows.find((r) => r.label === "Antiga")).toMatchObject({ pctQualified: 0, costPerQualifiedCents: null, spendCents: null });
    expect(rows.find((r) => r.label === "Sem campanha")).toMatchObject({ rated: 0, pctQualified: null });
    expect([total.leads, total.rated, total.qualified, total.spendCents, total.costPerQualifiedCents]).toEqual([6, 4, 2, 30000, 15000]);
  });
});

describe("decodeCsv", () => {
  it("lê UTF-8 (com e sem BOM) e UTF-16 da Meta", () => {
    const utf8 = new TextEncoder().encode("nome\nVídeo");
    expect(decodeCsv(utf8.buffer)).toBe("nome\nVídeo");
    expect(decodeCsv(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]).buffer)).toBe("nome\nVídeo");
    const s = "nome\tcampanha\nJoão\tA";
    const u16 = new Uint8Array(2 + s.length * 2);
    u16.set([0xff, 0xfe]);
    for (let i = 0; i < s.length; i++) { u16[2 + i * 2] = s.charCodeAt(i) & 0xff; u16[3 + i * 2] = s.charCodeAt(i) >> 8; }
    expect(decodeCsv(u16.buffer)).toBe(s);
  });
});
