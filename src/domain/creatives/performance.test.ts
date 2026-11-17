import { describe, expect, it } from "vitest";
import { costPerResult, creativeCode, creativeKpis, nameHasCode, parseSort, suggestedStatus, type CreativeTotals } from "./performance";

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
