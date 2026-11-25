import { describe, expect, it } from "vitest";
import { googleAdStatus, googleInsight, googleObjective, googleStatus, microsToCents } from "./google";
import { kpis, resultKind } from "./index";

describe("Google Ads → tabelas do sistema", () => {
  it("converte micros em centavos", () => {
    expect(microsToCents("12345678")).toBe(1235);
    expect(microsToCents(0)).toBe(0);
    expect(microsToCents(null)).toBeNull();
    expect(microsToCents("abc")).toBeNull();
  });

  it("traduz a situação para a da Meta e marca reprovação", () => {
    expect(googleStatus("ENABLED")).toBe("ACTIVE");
    expect(googleStatus("PAUSED")).toBe("PAUSED");
    expect(googleStatus("REMOVED")).toBe("DELETED");
    expect(googleAdStatus("ENABLED", "DISAPPROVED")).toBe("DISAPPROVED");
    expect(googleAdStatus("ENABLED", "APPROVED")).toBe("ACTIVE");
  });

  it("números do dia: custo, cliques como cliques no link, conversões como resultado", () => {
    const m = googleInsight({ costMicros: "25500000", impressions: "1000", clicks: "40", conversions: 3.6, conversionsValue: 1500.5 });
    expect(m).toMatchObject({ spend_cents: 2550, impressions: 1000, clicks: 40, link_clicks: 40, leads: 4, purchase_value_cents: 150050 });
  });

  it("resultado da campanha do Google: conversão, senão clique", () => {
    const obj = googleObjective("SEARCH");
    expect(obj).toBe("GOOGLE_SEARCH");
    expect(resultKind(obj, { leads: 5 })).toBe("leads");
    expect(resultKind(obj, { leads: 0 })).toBe("link_clicks");
    const t = { spend_cents: 10000, impressions: 2000, reach: 0, clicks: 50, link_clicks: 50, leads: 4, messages: 0, purchases: 0, purchase_value_cents: 40000, landing_page_views: 0, video_views: 0, thruplays: 0 };
    const k = kpis(t as never, resultKind(obj, t));
    expect(k.costPerResultCents).toBe(2500);
    expect(k.roas).toBe(4);
  });
});
