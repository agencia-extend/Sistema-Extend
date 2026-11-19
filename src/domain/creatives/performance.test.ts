import { describe, expect, it } from "vitest";
import { costPerResult, creativeCode, creativeKpis, nameHasCode, parsePerfPeriod, parseSort, perfPeriodLabel, perfRange, recentMonths, suggestedStatus, topCreatives, type CreativeTotals } from "./performance";
import { libraryCsv } from "./export";

const base: CreativeTotals = {
  ads: 1, activeAds: 1, spendCents: 10_000, impressions: 5_000, clicks: 120, linkClicks: 100, leads: 4, messages: 0, purchases: 0,
  purchaseValueCents: 0, videoViews: 1_500, thruplays: 400, daysLive: 5, firstDay: "2026-11-01", lastDay: "2026-11-05", frequency: 1.8, fatigued: false,
};

describe("creativeKpis", () => {
  it("calcula CTR, CPC, CPM, CPL, hook e hold", () => {
    const k = creativeKpis(base);
    expect(k.ctr).toBeCloseTo(0.02);
    expect(k.cpcCents).toBe(100);
    expect(k.cpmCents).toBe(2_000);
    expect(k.cplCents).toBe(2_500);
    expect(k.costPerMessageCents).toBeNull();
    expect(k.hookRate).toBeCloseTo(0.3);
    expect(k.holdRate).toBeCloseTo(0.08);
    expect(k.roas).toBeNull();
  });
  it("sem impressões nem vídeo não divide por zero", () => {
    const k = creativeKpis({ ...base, spendCents: 0, impressions: 0, clicks: 0, linkClicks: 0, leads: 0, videoViews: 0, thruplays: 0 });
    expect(Object.values(k).every((v) => v === null)).toBe(true);
  });
  it("ROAS com valor de compra", () => {
    expect(creativeKpis({ ...base, purchaseValueCents: 35_000 }).roas).toBeCloseTo(3.5);
  });
});

describe("código no nome do anúncio", () => {
  it("aceita as variações e recusa números maiores", () => {
    expect(creativeCode(42)).toBe("CR-42");
    for (const n of ["VIDEO_DOR_CR-42_V2", "cr42 - feed", "CR-0042", "[CR-42]"]) expect(nameHasCode(n, 42)).toBe(true);
    for (const n of ["CR-420", "SCR-42", "CR-4", "VIDEO_42"]) expect(nameHasCode(n, 42)).toBe(false);
  });
});

describe("sugestão e ordenação", () => {
  it("sugere fadigado só para em teste ou vencedor com fadiga", () => {
    expect(suggestedStatus("em_teste", { fatigued: true })).toBe("fadigado");
    expect(suggestedStatus("vencedor", { fatigued: true })).toBe("fadigado");
    expect(suggestedStatus("fadigado", { fatigued: true })).toBeNull();
    expect(suggestedStatus("em_teste", { fatigued: false })).toBeNull();
    expect(suggestedStatus("em_teste", null)).toBeNull();
  });
  it("custo por resultado: lead, conversa, compra", () => {
    expect(costPerResult(base)).toBe(2_500);
    expect(costPerResult({ ...base, leads: 0, messages: 5 })).toBe(2_000);
    expect(costPerResult({ ...base, leads: 0 })).toBeNull();
    expect(parseSort("ctr")).toBe("ctr");
    expect(parseSort("x")).toBe("recentes");
  });
});

describe("período e top criativos (RF-BIB-04)", () => {
  it("meses recentes, rótulos e datas", () => {
    expect(recentMonths("2026-02-10", 3)).toEqual(["2026-02", "2026-01", "2025-12"]);
    expect(parsePerfPeriod("2026-01", "2026-02-10")).toBe("2026-01");
    expect(parsePerfPeriod("2024-01", "2026-02-10")).toBe("tudo");
    expect(parsePerfPeriod("30d", "2026-02-10")).toBe("30d");
    expect(perfPeriodLabel("2026-03")).toBe("março de 2026");
    expect(perfRange("2026-02", "2026-02-10")).toEqual({ since: "2026-02-01", until: "2026-02-28" });
    expect(perfRange("2025-12", "2026-02-10")).toEqual({ since: "2025-12-01", until: "2025-12-31" });
    expect(perfRange("30d", "2026-02-10")).toEqual({ since: "2026-01-11", until: "2026-02-09" });
    expect(perfRange("tudo", "2026-02-10")).toBeUndefined();
  });
  it("mais resultados primeiro; empate pelo menor custo; sem resultado fica de fora", () => {
    const t = (spend: number, leads: number, messages = 0): CreativeTotals => ({ ...base, spendCents: spend, leads, messages });
    const perf = new Map([["a", t(10000, 5)], ["b", t(5000, 5)], ["c", t(3000, 0, 9)], ["d", t(9000, 0)]]);
    expect(topCreatives([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }], perf).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
  it("CSV com os números", () => {
    const row = { clientName: "Pizzaria", campaign: "Rodízio", format: "imagem" as const, angle: "Dobro", status: "vencedor" as const, primaryText: null, headline: null,
      approvedAt: "2026-11-02T10:00:00Z", link: "https://x/criativos/1", totals: { ...base, spendCents: 30000, impressions: 10000, linkClicks: 200, leads: 12 } };
    const csv = libraryCsv([row], true);
    expect(csv).toContain('"Investimento (R$)";"Impressões";"CTR (%)";"Resultados";"Custo por resultado (R$)"');
    expect(csv).toContain('"300,00";"10000";"2,00";"12";"25,00"');
    expect(libraryCsv([row])).not.toContain("Investimento");
  });
});
