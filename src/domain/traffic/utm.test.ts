import { describe, expect, it } from "vitest";
import { buildUtmUrl, googleTrackingTemplate, normalizeBaseUrl, UTM_PRESETS, utmQuery, utmValue } from "./utm";

describe("links com UTM", () => {
  it("normaliza o que foi digitado e preserva os parâmetros dinâmicos", () => {
    expect(utmValue("  Black Friday Clareamento ")).toBe("black_friday_clareamento");
    expect(utmValue("Promoção (Novembro)!")).toBe("promocao_novembro");
    expect(utmValue("{{campaign.name}}")).toBe("{{campaign.name}}");
    expect(utmValue("BF_{campaignid}")).toBe("bf_{campaignid}");
  });

  it("monta a URL da Meta com as chaves sem codificar", () => {
    expect(buildUtmUrl("https://clinica.com.br/clareamento", UTM_PRESETS.meta)).toBe(
      "https://clinica.com.br/clareamento?utm_source={{site_source_name}}&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}",
    );
  });

  it("mantém parâmetros e âncora do destino e troca UTMs antigas", () => {
    const p = { source: "instagram", medium: "bio", campaign: "Black Friday", term: "", content: "" };
    expect(buildUtmUrl("clinica.com.br/?ref=x&utm_source=velho#agenda", p)).toBe(
      "https://clinica.com.br/?ref=x&utm_source=instagram&utm_medium=bio&utm_campaign=black_friday#agenda",
    );
  });

  it("recusa destino que não é site", () => {
    expect(normalizeBaseUrl("")).toBeNull();
    expect(normalizeBaseUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeBaseUrl("localhost")).toBeNull();
    expect(buildUtmUrl("ftp://x.com", UTM_PRESETS.meta)).toBeNull();
  });

  it("gera os parâmetros e o modelo do Google", () => {
    expect(utmQuery({ source: "google", medium: "cpc", campaign: "{campaignid}", term: "", content: "" })).toBe("utm_source=google&utm_medium=cpc&utm_campaign={campaignid}");
    expect(googleTrackingTemplate(UTM_PRESETS.google)).toBe("{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}");
  });
});
