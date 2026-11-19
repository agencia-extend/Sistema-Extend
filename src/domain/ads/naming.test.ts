import { describe, expect, it } from "vitest";
import { DEFAULT_NAMING, buildName, checkName, exampleName, normalizePiece, parseNaming, type NamingPart } from "./naming";

const parts = (t: string) => (parseNaming(t) as { parts: NamingPart[] }).parts;

describe("nomenclatura padrão", () => {
  it("lê o padrão e recusa peça desconhecida, chave solta ou peças coladas", () => {
    expect(parts(DEFAULT_NAMING.campaign).filter((p) => p.kind === "token").map((p) => (p as { key: string }).key)).toEqual(["CLIENTE", "OBJETIVO", "PUBLICO", "AAAA-MM"]);
    expect(parseNaming("{CLIENTE}_{PRODUTO}")).toEqual({ error: "Peça desconhecida: {PRODUTO}. Use as peças dos botões." });
    expect(parseNaming("{CLIENTE}_{OBJETIVO")).toEqual({ error: "Chave sem par: confira { e }." });
    expect(parseNaming("{CLIENTE}{OBJETIVO}")).toMatchObject({ error: expect.stringContaining("Separe as peças") });
    expect(parseNaming("CAMPANHA")).toMatchObject({ error: expect.stringContaining("pelo menos uma peça") });
  });
  it("verifica e diz a primeira peça errada", () => {
    const c = parts(DEFAULT_NAMING.campaign);
    expect(checkName("GWP_LEADS_FRIO_2026-11", c)).toEqual({ ok: true });
    expect(checkName("GWP_CADASTROS_FRIO_2026-11", c)).toMatchObject({ ok: false, reason: expect.stringContaining("objetivo fora do padrão") });
    expect(checkName("GWP_LEADS_FRIO_2026-13", c)).toMatchObject({ ok: false, reason: expect.stringContaining("mês fora do padrão") });
    expect(checkName("GWP_LEADS_FRIO", c)).toMatchObject({ ok: false, reason: expect.stringContaining('falta o separador "_"') });
    expect(checkName("GWP_LEADS_FRIO_2026-11_X", c)).toEqual({ ok: false, reason: "sobra texto no fim do nome" });
    expect(checkName("[EXTEND] | ENGAJAMENTO", c)).toMatchObject({ ok: false, reason: expect.stringContaining("cliente") });
    const a = parts(DEFAULT_NAMING.ad);
    expect(checkName("VIDEO_DOR-ALUGUEL_V2", a)).toEqual({ ok: true });
    expect(checkName("VIDEO_DOR ALUGUEL_V2", a)).toMatchObject({ ok: false });
  });
  it("gera o nome normalizado e o exemplo", () => {
    expect(normalizePiece("  Interesse imóveis! ")).toBe("INTERESSE-IMOVEIS");
    const a = parts("{FORMATO}_{ANGULO}_{CR}_{V#}");
    const name = buildName(a, { FORMATO: "VIDEO", ANGULO: "dor do aluguel", CR: "42", "V#": "2" });
    expect(name).toBe("VIDEO_DOR-DO-ALUGUEL_CR-42_V2");
    expect(checkName(name, a)).toEqual({ ok: true });
    expect(exampleName(parts(DEFAULT_NAMING.adset))).toBe("FRIO_FEED-STORIES_25-55");
  });
});
