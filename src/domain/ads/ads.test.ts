import { describe, expect, it } from "vitest";
import { daysLeft, kpis, parseInsight, periodRange, prepaidFundsCents, resultKind, sumDays, toCents } from ".";

describe("anúncios", () => {
  it("lê uma linha de insights da Meta", () => {
    const d = parseInsight({
      date_start: "2026-11-10",
      spend: "123.45",
      impressions: "1000",
      reach: "800",
      clicks: "40",
      actions: [
        { action_type: "link_click", value: "30" },
        { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "5" },
        { action_type: "lead", value: "2" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "2" },
        { action_type: "omni_purchase", value: "1" },
      ],
      action_values: [{ action_type: "omni_purchase", value: "250.00" }],
    });
    expect(d).toMatchObject({ spend_cents: 12345, impressions: 1000, link_clicks: 30, messages: 5, leads: 2, purchases: 1, purchase_value_cents: 25000 });
    expect(toCents("0.1")).toBe(10);
  });

  it("resultado pelo objetivo e indicadores", () => {
    const t = sumDays([
      { spend_cents: 10000, impressions: 5000, clicks: 100, link_clicks: 80, messages: 10 },
      { spend_cents: 5000, impressions: 2500, clicks: 50, link_clicks: 40, messages: 5 },
    ]);
    expect(resultKind("OUTCOME_LEADS")).toBe("leads");
    expect(resultKind("OUTCOME_ENGAGEMENT", t)).toBe("messages");
    expect(resultKind("OUTCOME_TRAFFIC", { link_clicks: 3 })).toBe("link_clicks");
    expect(resultKind("OUTCOME_AWARENESS")).toBe("impressions");
    const k = kpis(t, "messages");
    expect(k.results).toBe(15);
    expect(k.costPerResultCents).toBe(1000);
    expect(k.cpmCents).toBe(2000);
    expect(k.ctr).toBeCloseTo(120 / 7500);
  });

  it("saldo pré-pago e dias restantes", () => {
    expect(prepaidFundsCents("Saldo disponível (R$68,71 BRL)")).toBe(6871);
    expect(prepaidFundsCents("Saldo disponível (R$1.234,56 BRL)")).toBe(123456);
    expect(prepaidFundsCents("Available balance ($1,234.56 USD)")).toBe(123456);
    expect(prepaidFundsCents("Visa *1234")).toBeNull();
    expect(prepaidFundsCents(null)).toBeNull();
    expect(daysLeft(10000, [1000, 1000, 1000, 1000, 1000, 1000, 1000])).toBe(10);
    expect(daysLeft(10000, [0, 0])).toBeNull();
  });

  it("períodos", () => {
    expect(periodRange("7d", "2026-11-17")).toEqual({ start: "2026-11-11", end: "2026-11-17" });
    expect(periodRange("mes", "2026-11-17")).toEqual({ start: "2026-11-01", end: "2026-11-17" });
    expect(periodRange("ontem", "2026-11-01")).toEqual({ start: "2026-10-31", end: "2026-10-31" });
  });
});
