import { describe, expect, it } from "vitest";
import { fromApiPlace, placesQuery, prospectNotes, scorePlace, type PlaceResult } from "./prospector";

const base: PlaceResult = { id: "ChIJ123", name: "Imobiliária Sol", phone: "+55 51 99999-0000", website: null, address: "Rua A, 1", rating: 4.0, reviews: 12, mapsUrl: "https://maps.google.com/?cid=1", category: "Imobiliária", open: true };

describe("score do prospectador", () => {
  it("sem site, poucas avaliações, nota baixa e com telefone = oportunidade máxima", () => {
    const s = scorePlace(base);
    expect(s.score).toBe(90);
    expect(s.reasons.map((r) => r.text)).toContain("Sem site");
  });
  it("empresa estruturada pontua pouco", () => {
    expect(scorePlace({ ...base, website: "https://sol.com.br", reviews: 300, rating: 4.8, phone: null }).score).toBe(0);
  });
  it("Instagram como site conta como sem site próprio", () => {
    expect(scorePlace({ ...base, website: "https://instagram.com/sol", reviews: 300, rating: 4.8 }).reasons[0].points).toBe(20);
  });
  it("fechada definitivamente zera", () => {
    expect(scorePlace({ ...base, open: false }).score).toBe(0);
  });
  it("limita a 100", () => {
    expect(scorePlace({ ...base, rating: null, reviews: 0 }).score).toBeLessThanOrEqual(100);
  });
});

describe("dados do Google", () => {
  it("converte a resposta do Places e ignora local sem nome", () => {
    expect(fromApiPlace({ id: "x" })).toBeNull();
    const p = fromApiPlace({ id: "ChIJ9", displayName: { text: "Clínica" }, userRatingCount: 5, rating: 4.5, businessStatus: "OPERATIONAL" })!;
    expect(p).toMatchObject({ name: "Clínica", reviews: 5, rating: 4.5, open: true, phone: null });
  });
  it("monta a busca e a observação do lead", () => {
    expect(placesQuery(" imobiliária ", "Porto Alegre", "rs")).toBe("imobiliária em Porto Alegre, RS");
    const notes = prospectNotes(scorePlace(base), "imobiliária");
    expect(notes).toContain("score 90/100");
    expect(notes).toContain("Sem site");
  });
});
