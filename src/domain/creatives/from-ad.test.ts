import { describe, expect, it } from "vitest";
import { AD_REF, adsManagerUrl, objectiveFromMeta, prefillFromAd, type AdSource } from "./from-ad";

const ad: AdSource = {
  provider: "meta", accountExternalId: "act_123", adExternalId: "120200", adName: "CR-7 | Dor do aluguel | v1",
  campaignName: "Lançamento novembro", campaignObjective: "OUTCOME_LEADS", frequency: 3.46, fatigued: true,
  library: { code: "CR-7", format: "reels", angle: "Dor do aluguel", campaign: "Lançamento" },
};

describe("objectiveFromMeta", () => {
  it("traduz os objetivos novos e antigos", () => {
    expect(objectiveFromMeta("OUTCOME_LEADS")).toBe("leads");
    expect(objectiveFromMeta("MESSAGES")).toBe("mensagens");
    expect(objectiveFromMeta("OUTCOME_SALES")).toBe("vendas");
    expect(objectiveFromMeta("CONVERSIONS")).toBe("vendas");
    expect(objectiveFromMeta("OUTCOME_TRAFFIC")).toBe("trafego");
    expect(objectiveFromMeta("OUTCOME_AWARENESS")).toBe("reconhecimento");
    expect(objectiveFromMeta("OUTCOME_ENGAGEMENT")).toBe("engajamento");
    expect(objectiveFromMeta("APP_INSTALLS")).toBeNull();
    expect(objectiveFromMeta(null)).toBeNull();
  });
});

describe("prefillFromAd", () => {
  it("usa o criativo ligado e marca alta prioridade quando cansado", () => {
    const p = prefillFromAd(ad);
    expect(p).toMatchObject({ campaign: "Lançamento novembro", objective: "leads", format: "reels", angle: "Nova versão: Dor do aluguel", priority: "alta", sourceAdRef: "meta:120200" });
    expect(p.notes).toContain("CR-7");
    expect(p.notes).toContain("frequência 3,5 em 7 dias");
    expect(p.references[0]).toBe(adsManagerUrl("act_123", "120200"));
    expect(p.references[0]).toContain("act=123&selected_ad_ids=120200");
    expect(AD_REF.test(p.sourceAdRef)).toBe(true);
  });

  it("sem criativo ligado deixa formato e ângulo para a pessoa", () => {
    const p = prefillFromAd({ ...ad, library: null, fatigued: false, frequency: null, campaignObjective: "APP_INSTALLS" });
    expect(p).toMatchObject({ format: "", angle: "", objective: "", priority: "media" });
    expect(p.notes).toBe('Anúncio "CR-7 | Dor do aluguel | v1" precisa de uma nova versão. Pedido de um novo criativo para substituir.');
  });

  it("corta textos longos no limite do formulário", () => {
    const p = prefillFromAd({ ...ad, campaignName: "x".repeat(400) });
    expect(p.campaign.length).toBe(160);
  });
});
