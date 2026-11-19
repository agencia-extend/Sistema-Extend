import { describe, expect, it } from "vitest";
import { adsQuery, delta, groupKey, groupLabel, parseAdsFilters, periodGroups, statusMatches } from "./filters";

const today = "2026-11-18"; // quarta

describe("filtros do módulo Anúncios", () => {
  it("períodos e o anterior de mesma duração", () => {
    expect(parseAdsFilters({}, today)).toMatchObject({ preset: "7d", from: "2026-11-11", to: "2026-11-17", prevFrom: "2026-11-04", prevTo: "2026-11-10", days: 7 });
    expect(parseAdsFilters({ periodo: "mes" }, today)).toMatchObject({ from: "2026-11-01", to: "2026-11-18", prevFrom: "2026-10-14", prevTo: "2026-10-31" });
    expect(parseAdsFilters({ periodo: "mes_passado" }, today)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(parseAdsFilters({ periodo: "ontem" }, today)).toMatchObject({ from: "2026-11-17", to: "2026-11-17", prevFrom: "2026-11-16" });
    expect(parseAdsFilters({ periodo: "custom", de: "2026-11-20", ate: "2026-11-02" }, today)).toMatchObject({ from: "2026-11-02", to: "2026-11-18" });
    expect(parseAdsFilters({ periodo: "x", cliente: "nao-uuid", status: "ativas", agrupar: "semana" }, today)).toMatchObject({ preset: "7d", clientId: undefined, status: "ativas", group: "semana" });
  });
  it("query para as abas", () => {
    const f = parseAdsFilters({ periodo: "custom", de: "2026-11-01", ate: "2026-11-10", status: "pausadas" }, today);
    expect(adsQuery(f)).toBe("periodo=custom&de=2026-11-01&ate=2026-11-10&status=pausadas");
  });
  it("agrupamento do gráfico", () => {
    expect(groupKey("2026-11-18", "semana")).toBe("2026-11-16");
    expect(groupKey("2026-11-18", "mes")).toBe("2026-11");
    expect(groupLabel("2026-11-16", "semana")).toBe("sem. 16/11");
    expect(groupLabel("2026-11", "mes")).toBe("nov/26");
    expect(periodGroups("2026-11-15", "2026-11-18", "dia")).toEqual(["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"]);
    expect(periodGroups("2026-11-15", "2026-11-18", "semana")).toEqual(["2026-11-09", "2026-11-16"]);
  });
  it("status e variação", () => {
    expect(statusMatches("ACTIVE", "ativas")).toBe(true);
    expect(statusMatches("CAMPAIGN_PAUSED", "pausadas")).toBe(true);
    expect(statusMatches("ACTIVE", "pausadas")).toBe(false);
    expect(delta(120, 100)).toEqual({ pct: 20, up: true });
    expect(delta(80, 100)).toEqual({ pct: -20, up: false });
    expect(delta(5, 0)).toEqual({ pct: null, up: true });
    expect(delta(0, 0)).toEqual({ pct: 0, up: true });
  });
});
