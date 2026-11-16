import { describe, expect, it } from "vitest";
import { avoidSummary } from "./rejections";

describe("o que evitar (reprovações da Meta)", () => {
  const rows = [
    { reason: "antes_depois", format: "imagem", angle: "Antes e depois do clareamento", lesson: "Sem comparação", rejectedOn: "2026-11-02" },
    { reason: "saude", format: "video", angle: "Depoimento", lesson: null, rejectedOn: "2026-11-10" },
    { reason: "antes_depois", format: "carrossel", angle: "antes e depois do clareamento", lesson: "sem comparação", rejectedOn: "2026-11-05" },
    { reason: "desconhecido", format: "story", angle: "Promo", lesson: "", rejectedOn: "2026-10-01" },
  ];
  it("agrupa por motivo, o mais frequente primeiro, sem repetir ângulo nem lição", () => {
    const s = avoidSummary(rows);
    expect(s.map((x) => [x.reason, x.count])).toEqual([["antes_depois", 2], ["saude", 1], ["outro", 1]]);
    expect(s[0]).toMatchObject({ formats: ["imagem", "carrossel"], angles: ["Antes e depois do clareamento"], lessons: ["Sem comparação"], lastOn: "2026-11-05" });
  });
  it("empate vai pelo mais recente e respeita o limite", () => {
    expect(avoidSummary(rows, 2).map((x) => x.reason)).toEqual(["antes_depois", "saude"]);
    expect(avoidSummary([])).toEqual([]);
  });
});
